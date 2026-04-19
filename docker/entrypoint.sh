#!/bin/sh
# Container entrypoint: wait for Postgres → run pending migrations → start app.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "FATAL: DATABASE_URL is not set" >&2
  exit 1
fi

echo "[entrypoint] Waiting for Postgres..."
# Extract host:port from DATABASE_URL for a simple TCP wait. Prisma itself
# retries the first connection, but failing fast here gives clearer logs.
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|^postgres(ql)?://[^@]+@([^:/]+).*|\2|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|^postgres(ql)?://[^@]+@[^:]+:([0-9]+).*|\2|')
DB_PORT=${DB_PORT:-5432}

i=0
until nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "[entrypoint] Postgres not reachable at $DB_HOST:$DB_PORT after 60s — giving up." >&2
    exit 1
  fi
  sleep 1
done
echo "[entrypoint] Postgres reachable at $DB_HOST:$DB_PORT."

echo "[entrypoint] Running prisma migrate deploy..."
# Standalone build doesn't include node_modules/.bin symlinks, so invoke
# the Prisma CLI entry point directly instead of via `npx`/the bin wrapper.
node ./node_modules/prisma/build/index.js migrate deploy

# Optional: seed on first boot if SEED_ON_BOOT=true. Idempotent (seed uses upsert).
# Skipped by default — the standalone runtime doesn't ship tsx and the seed
# script is TypeScript. Run seeds from the host with `docker compose exec app ...`
# if/when needed.
if [ "${SEED_ON_BOOT:-false}" = "true" ]; then
  echo "[entrypoint] SEED_ON_BOOT=true but tsx is not bundled in the runtime image; skipping."
fi

echo "[entrypoint] Starting app: $*"
exec "$@"
