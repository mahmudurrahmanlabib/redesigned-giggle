# SovereignML — Deployment Guide

> AI Operations Platform for deploying and managing intelligent agents.

---

## Stack Overview

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, standalone output) |
| Runtime | React 19, Node.js 20 |
| Language | TypeScript 5 |
| Database | PostgreSQL 16 via Drizzle ORM |
| Auth | NextAuth v5 (Credentials + Google OAuth) |
| Payments | Stripe |
| Email | Resend |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Process manager | PM2 or systemd |

---

## Quick Start (local development)

```bash
git clone <repo-url> sovereignml
cd sovereignml
npm install
```

### Bootstrap Postgres + .env + schema

```bash
bash scripts/bootstrap-pg.sh
```

This idempotent script creates the `sovereignml` Postgres role/database,
writes `.env` with `DATABASE_URL` and `AUTH_SECRET`, and syncs the schema
via `drizzle-kit push`.

To also seed the database (regions, server configs, plans, admin user):

```bash
DB_SEED=1 bash scripts/bootstrap-pg.sh
```

Default admin: `admin@sovereignml.com` / `admin123456` — change immediately.

### Start dev server

```bash
npm run dev
```

Visit: http://localhost:3000

---

## Database Management

Schema lives in `src/db/schema.ts`. Managed with Drizzle Kit:

```bash
npm run db:push      # Sync schema → Postgres
npm run db:seed      # Seed regions, plans, admin user
npm run db:studio    # Open Drizzle Studio (data browser)
```

---

## Production Deployment (bare-metal VPS)

See [`deploy/README.md`](deploy/README.md) for the full runbook. Summary:

```bash
# On the VPS
npm ci --no-audit --no-fund
bash scripts/bootstrap-pg.sh
npm run build
pm2 start deploy/pm2.config.cjs
pm2 save && pm2 startup
```

Point nginx or Cloudflare Tunnel at `127.0.0.1:3000`.

---

## Stripe Setup

1. Create three products in Stripe Dashboard (Starter, Pro, Enterprise)
2. Copy `price_...` IDs into `.env`
3. Add webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`
4. Events: `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
5. Copy signing secret → `STRIPE_WEBHOOK_SECRET`

Local testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

---

## Google OAuth Setup

1. Google Cloud Console → OAuth 2.0 Client ID
2. Redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - `https://yourdomain.com/api/auth/callback/google` (prod)
3. Copy Client ID + Secret → `.env`

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_URL` | Yes | Full URL of your deployment |
| `NEXTAUTH_SECRET` | Yes | Random 32+ byte secret for JWT signing |
| `AUTH_TRUST_HOST` | Yes | `true` for proxied/cloud deployments |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `STRIPE_SECRET_KEY` | Prod | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Prod | Stripe webhook signing secret |
| `STRIPE_PRICE_*` | Prod | Stripe Price IDs for each plan/interval |
| `RESEND_API_KEY` | No | Resend API key for transactional email |
| `RESEND_FROM_EMAIL` | No | Verified sender address |
| `NEXT_PUBLIC_APP_URL` | Yes | Public-facing app URL |
| `INSTANCE_ENCRYPTION_KEY` | Yes | Base64-encoded 32-byte key for AES-256-GCM |
| `LINODE_API_TOKEN` | Prod | Linode API token for provisioning |
| `SSH_FLEET_PRIVATE_KEY` | Prod | SSH key for fleet management |

---

## Troubleshooting

- **Auth redirect loops** — ensure `NEXTAUTH_URL` matches your deployment URL exactly, and `AUTH_TRUST_HOST=true` is set behind a proxy.
- **Database not in sync** — run `npm run db:push`.
- **Email not sending** — verify `RESEND_API_KEY` and sending domain.
- **Stripe webhook errors** — check `STRIPE_WEBHOOK_SECRET` matches Dashboard.
