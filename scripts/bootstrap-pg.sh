#!/usr/bin/env bash
# Idempotent Postgres bootstrap for redesigned-giggle.
#
# Creates/aligns the `sovereignml` role + database, writes .env with a
# matching DATABASE_URL (and an AUTH_SECRET if missing), verifies
# pg_hba.conf allows password auth on 127.0.0.1, runs a smoke test,
# and syncs the Prisma schema.
#
# Re-runnable: if .env already has a working DATABASE_URL, the existing
# password is preserved and only missing pieces are filled in.
#
# Usage:
#   bash scripts/bootstrap-pg.sh
#   DB_SEED=1 bash scripts/bootstrap-pg.sh    # also runs prisma seed

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
DB_NAME="${DB_NAME:-sovereignml}"
DB_USER="${DB_USER:-sovereignml}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"

log()  { printf "\033[1;34m[bootstrap]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[bootstrap]\033[0m %s\n" "$*" >&2; }
die()  { printf "\033[1;31m[bootstrap]\033[0m %s\n" "$*" >&2; exit 1; }

banned=(.env.local .env.production .env.production.local)
for f in "${banned[@]}"; do
  if [ -e "$REPO_ROOT/$f" ]; then
    die "Found banned env file: $f. This project loads only .env. Delete it and re-run."
  fi
done

command -v psql >/dev/null 2>&1 || die "psql not found. Install postgresql-client."
command -v openssl >/dev/null 2>&1 || die "openssl not found."

log "Checking Postgres is reachable as 'postgres' superuser..."
if ! sudo -n -u postgres psql -Atc "SELECT 1" >/dev/null 2>&1; then
  die "Can't reach Postgres as the 'postgres' user via sudo. Is it installed and running?  Try: sudo systemctl status postgresql"
fi

HBA_FILE="$(sudo -u postgres psql -Atc 'SHOW hba_file' 2>/dev/null || true)"
if [ -n "$HBA_FILE" ] && [ -r "$HBA_FILE" ]; then
  log "Checking $HBA_FILE for 127.0.0.1 auth method..."
  if sudo grep -E '^host\s+all\s+all\s+127\.0\.0\.1/32\s+(peer|ident|trust)\b' "$HBA_FILE" >/dev/null 2>&1; then
    warn "pg_hba.conf has host all all 127.0.0.1/32 using peer/ident/trust."
    warn "That means password auth will fail silently. Recommend scram-sha-256."
    read -r -p "Patch pg_hba.conf to scram-sha-256 and reload Postgres? [y/N] " yn
    if [[ "$yn" =~ ^[Yy]$ ]]; then
      sudo sed -i.bak -E 's|^(host\s+all\s+all\s+127\.0\.0\.1/32\s+)(peer|ident|trust)\b|\1scram-sha-256|' "$HBA_FILE"
      sudo systemctl reload postgresql || sudo systemctl reload postgresql@*-main
      log "pg_hba.conf patched (backup at ${HBA_FILE}.bak) and postgresql reloaded."
    else
      warn "Skipping pg_hba.conf fix. If auth fails later, patch manually."
    fi
  fi
else
  warn "Could not read hba_file ($HBA_FILE). Skipping auth-method check."
fi

extract_env() {
  # $1 = key, stdin = env file content. Prints the value or empty.
  sed -n -E "s/^${1}=\"?([^\"]*)\"?\$/\1/p" < "$ENV_FILE" 2>/dev/null | tail -n1 || true
}

EXISTING_URL=""
EXISTING_AUTH=""
if [ -f "$ENV_FILE" ]; then
  EXISTING_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | tail -n1 | sed -E 's/^DATABASE_URL=//;s/^"//;s/"$//') || true
  EXISTING_AUTH=$(grep -E '^AUTH_SECRET=' "$ENV_FILE"   | tail -n1 | sed -E 's/^AUTH_SECRET=//;s/^"//;s/"$//') || true
fi

is_placeholder() {
  case "$1" in
    ""|*"user:password"*|*"sovereignml:password@"*|"file:./dev.db") return 0 ;;
    *) return 1 ;;
  esac
}

if is_placeholder "$EXISTING_URL"; then
  DB_PASSWORD="$(openssl rand -hex 24)"
  log "Generated a new DB password (24 bytes hex)."
else
  # Reuse the existing URL's password so a re-run doesn't churn creds.
  DB_PASSWORD="$(printf '%s' "$EXISTING_URL" | sed -E 's|^postgres(ql)?://[^:]+:([^@]+)@.*$|\2|')"
  if [ -z "$DB_PASSWORD" ]; then
    DB_PASSWORD="$(openssl rand -hex 24)"
    log "Existing DATABASE_URL has no parseable password; generated a new one."
  else
    log "Reusing password from existing DATABASE_URL."
  fi
fi

DB_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"

log "Ensuring role '$DB_USER' and database '$DB_NAME' exist with that password..."
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', '${DB_USER}', '${DB_PASSWORD}');
  ELSE
    EXECUTE format('CREATE ROLE %I WITH LOGIN PASSWORD %L', '${DB_USER}', '${DB_PASSWORD}');
  END IF;
END
\$\$;
SELECT 'createdb' FROM pg_database WHERE datname = '${DB_NAME}'\gset
\echo
SQL

if ! sudo -u postgres psql -Atc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
  log "Created database '$DB_NAME' owned by '$DB_USER'."
else
  log "Database '$DB_NAME' already exists — leaving it alone."
fi

log "Writing .env..."
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"
TMP="$(mktemp)"
if grep -v -E '^(DATABASE_URL|AUTH_SECRET)=' "$ENV_FILE" > "$TMP" 2>/dev/null; then :; fi
mv "$TMP" "$ENV_FILE"

if [ -z "$EXISTING_AUTH" ] || [ "$EXISTING_AUTH" = "" ]; then
  AUTH_SECRET="$(openssl rand -base64 32)"
  log "Generated a new AUTH_SECRET."
else
  AUTH_SECRET="$EXISTING_AUTH"
  log "Preserved existing AUTH_SECRET."
fi

{
  echo "DATABASE_URL=${DB_URL}"
  echo "AUTH_SECRET=${AUTH_SECRET}"
} >> "$ENV_FILE"

log "Smoke-testing the connection (psql)..."
if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c 'select 1' >/dev/null; then
  die "psql select 1 failed. Check pg_hba.conf / Postgres logs. URL: postgresql://${DB_USER}:***@${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi
log "Postgres OK."

log "Syncing schema (prisma db push)..."
cd "$REPO_ROOT"
node --env-file=.env node_modules/prisma/build/index.js db push --accept-data-loss

if [ "${DB_SEED:-0}" = "1" ]; then
  log "Seeding (DB_SEED=1)..."
  node --env-file=.env --import tsx prisma/seed.ts || warn "Seed failed (non-fatal)."
fi

cat <<DONE

──────────────────────────────────────────────────────────────
  Bootstrap complete.

  DATABASE_URL → written to .env
  Schema       → synced via prisma db push

  Next:
    pm2 start deploy/pm2.config.cjs
    pm2 save
    pm2 logs redesigned-giggle

  Re-run this script any time — it's idempotent.
──────────────────────────────────────────────────────────────
DONE
