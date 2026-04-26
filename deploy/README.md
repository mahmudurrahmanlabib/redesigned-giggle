# Bare-metal VPS deploy

Node + Postgres installed directly on a VPS, with the Next.js standalone
server managed by **pm2** or **systemd**.

## Env policy — read this once

The app loads **exactly one env file: `.env` at the repo root**. Next.js'
multi-file layering (`.env.local`, `.env.production`, ...) has bitten
this project in production and is now explicitly banned:

- `.gitignore` ignores all of them.
- `deploy/pm2.config.cjs` refuses to start if any of them exist on disk.
- The bootstrap script refuses to run if any of them exist.

If you need a different value per environment, change `.env` on that
box. Don't create a second env file.

## 1. Prerequisites on the VPS

```bash
# Node 22 (NodeSource; aligns with OpenClaw VPS bootstrap)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql

# pm2 for process management
sudo npm i -g pm2
```

## 2. Clone + install

```bash
sudo mkdir -p /opt/redesigned-giggle /var/log/redesigned-giggle
sudo chown -R $USER /opt/redesigned-giggle /var/log/redesigned-giggle

git clone <repo> /opt/redesigned-giggle
cd /opt/redesigned-giggle
npm ci --no-audit --no-fund
```

## 3. Bootstrap Postgres + .env + schema — one command

```bash
bash scripts/bootstrap-pg.sh
```

That script is idempotent and does everything the old runbook did by hand:

- Verifies Postgres is reachable as the `postgres` superuser.
- Sanity-checks `pg_hba.conf` — if `127.0.0.1/32` is using
  `peer`/`ident`/`trust`, prompts to patch it to `scram-sha-256` and
  reload Postgres (password auth silently fails otherwise).
- Creates/aligns the `sovereignml` role + database.
- Writes `.env` (mode 600) with a matching `DATABASE_URL` and an
  `AUTH_SECRET` if one isn't already set. Re-runs preserve the existing
  password.
- Smoke-tests the connection with `psql`.
- Syncs the schema with `drizzle-kit push`.
- `DB_SEED=1 bash scripts/bootstrap-pg.sh` also runs the seed.

Add any other secrets you need (`NEXTAUTH_URL`, `STRIPE_*`, `RESEND_*`,
...) to `.env` after the script finishes.

## 4. Build

```bash
npm run build       # admin/dashboard are force-dynamic, safe with no DB
```

## 5. Start — pick one

### pm2

```bash
pm2 start deploy/pm2.config.cjs
pm2 save
pm2 startup          # follow the printed command once, for boot persistence
pm2 logs redesigned-giggle
```

### systemd

```bash
# Create the service user once:
sudo useradd --system --home /opt/redesigned-giggle --shell /usr/sbin/nologin nextjs
sudo chown -R nextjs:nextjs /opt/redesigned-giggle /var/log/redesigned-giggle

sudo cp deploy/redesigned-giggle.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now redesigned-giggle
journalctl -u redesigned-giggle -f
```

## 6. Upgrades

```bash
cd /opt/redesigned-giggle
git pull
npm ci --no-audit --no-fund
bash scripts/bootstrap-pg.sh        # idempotent: syncs schema, preserves .env
npm run build
pm2 restart redesigned-giggle       # or: sudo systemctl restart redesigned-giggle
```

## 7. Reverse proxy

Point nginx / Cloudflare Tunnel at `127.0.0.1:3000`. Standard Next.js
reverse-proxy setup — no special headers required beyond `X-Forwarded-*`.

## Troubleshooting

- **`[pm2 guard] Refusing to start: ... these files exist`** — you have
  a stray `.env.production` or `.env.local`. Copy anything you need into
  `.env` and delete the others.
- **`Authentication failed against the database server`** — the
  `DATABASE_URL` password doesn't match the Postgres role's password.
  Re-run `bash scripts/bootstrap-pg.sh` — it re-aligns them.
- **pg_hba peer/ident/trust** — the bootstrap script offers to patch
  this. If you declined, edit `/etc/postgresql/*/main/pg_hba.conf`,
  change the `127.0.0.1/32` line to `scram-sha-256`, and
  `sudo systemctl reload postgresql`.
