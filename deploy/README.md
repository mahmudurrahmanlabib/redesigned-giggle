# Bare-metal VPS deploy

This is the non-Docker path: Node + Postgres installed directly on a VPS,
with the Next.js standalone server managed by **pm2** or **systemd**.

The Docker path (`docker compose up -d`) still works and is unchanged —
pick one.

## 1. Prerequisites on the VPS

```bash
# Node 20 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Postgres 16 (or use the managed one you already have)
sudo apt-get install -y postgresql

# Either pm2 or systemd is fine — only one.
sudo npm i -g pm2    # skip if using systemd
```

## 2. Database

```bash
sudo -u postgres psql <<'SQL'
CREATE USER giggle WITH PASSWORD 'change-me';
CREATE DATABASE giggle OWNER giggle;
SQL
```

## 3. App

```bash
sudo mkdir -p /opt/redesigned-giggle /var/log/redesigned-giggle
sudo chown -R $USER /opt/redesigned-giggle /var/log/redesigned-giggle

git clone <repo> /opt/redesigned-giggle
cd /opt/redesigned-giggle
npm ci --no-audit --no-fund
npx prisma generate
npm run build              # safe with no DB — admin/dashboard are force-dynamic
```

## 4. Environment

Create `/etc/redesigned-giggle.env` (chmod 600):

```
DATABASE_URL=postgresql://giggle:change-me@127.0.0.1:5432/giggle?schema=public
AUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=https://your-domain.example
# ...any other runtime secrets (STRIPE_*, RESEND_*, etc.)
```

## 5. Run migrations

```bash
set -a; . /etc/redesigned-giggle.env; set +a
npm run deploy:migrate
```

## 6. Start — pick one

### pm2

```bash
pm2 start deploy/pm2.config.cjs
pm2 save
pm2 startup          # follow the printed command once, for boot persistence
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

## 7. Upgrades

```bash
cd /opt/redesigned-giggle
git pull
npm ci --no-audit --no-fund
npx prisma generate
npm run build
npm run deploy:migrate
pm2 restart redesigned-giggle       # or: sudo systemctl restart redesigned-giggle
```

## 8. Reverse proxy

Point nginx / Cloudflare Tunnel at `127.0.0.1:3000`. Standard Next.js
reverse-proxy setup — no special headers required beyond `X-Forwarded-*`.
