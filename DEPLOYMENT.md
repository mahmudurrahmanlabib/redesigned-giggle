# SovereignML — Deployment Guide

> Production-grade Next.js SaaS platform. AI Operations Platform for deploying and managing intelligent agents.

---

## Stack Overview

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.1 (App Router, Turbopack) |
| Runtime | React 19.2.4 |
| Language | TypeScript 5 |
| Database | SQLite via Prisma 7.5.0 + better-sqlite3 |
| Auth | NextAuth v5 (Credentials + Google OAuth) |
| Payments | Stripe 17.5.0 |
| Email | Resend |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Animations | Framer Motion |

---

## Prerequisites

- Node.js 20+
- npm 10+
- A Stripe account (for billing)
- A Google Cloud project (for OAuth — optional)
- A Resend account (for transactional email)

---

## Local Development

### 1. Clone and install

```bash
git clone <repo-url> sovereignml
cd sovereignml
npm install
```

### 2. Configure environment variables

Copy the example and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Database
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<generate: openssl rand -base64 32>"
AUTH_TRUST_HOST=true

# Google OAuth (optional)
GOOGLE_CLIENT_ID="<from Google Cloud Console>"
GOOGLE_CLIENT_SECRET="<from Google Cloud Console>"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_STARTER_MONTHLY="price_..."
STRIPE_PRICE_STARTER_YEARLY="price_..."
STRIPE_PRICE_PRO_MONTHLY="price_..."
STRIPE_PRICE_PRO_YEARLY="price_..."
STRIPE_PRICE_ENTERPRISE_MONTHLY="price_..."
STRIPE_PRICE_ENTERPRISE_YEARLY="price_..."

# Email (Resend)
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="noreply@sovereignml.com"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Instance password encryption (32 bytes, base64)
INSTANCE_ENCRYPTION_KEY="<generate: openssl rand -base64 32>"
```

### 3. Generate Prisma client

```bash
npx prisma generate
```

### 4. Apply database schema

```bash
npx prisma db push
```

### 5. Seed the database

This creates: 6 regions, 16 server configs, 3 subscription plans, and 1 admin user.

```bash
npx prisma db seed
```

Default admin credentials:
- **Email:** `admin@sovereignml.com`
- **Password:** `admin123456`

> ⚠️ Change the admin password immediately after first login.

### 6. Start development server

```bash
npm run dev
```

Visit: [http://localhost:3000](http://localhost:3000)

---

## Stripe Setup

### Create Products and Prices

In the Stripe Dashboard (or CLI), create three products:

| Product | Monthly Price ID | Yearly Price ID |
|---------|-----------------|----------------|
| Starter ($5/mo) | `STRIPE_PRICE_STARTER_MONTHLY` | `STRIPE_PRICE_STARTER_YEARLY` |
| Pro ($29/mo) | `STRIPE_PRICE_PRO_MONTHLY` | `STRIPE_PRICE_PRO_YEARLY` |
| Enterprise ($199/mo) | `STRIPE_PRICE_ENTERPRISE_MONTHLY` | `STRIPE_PRICE_ENTERPRISE_YEARLY` |

Copy the `price_...` IDs into your `.env`.

### Configure Webhook

1. In Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://yourdomain.com/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Copy the signing secret → `STRIPE_WEBHOOK_SECRET`

### Local Webhook Testing

```bash
# Install Stripe CLI
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select a project
3. Enable the **Google+ API**
4. Credentials → Create OAuth 2.0 Client ID
5. Application type: **Web application**
6. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - `https://yourdomain.com/api/auth/callback/google` (prod)
7. Copy Client ID and Secret → `.env`

---

## Resend Email Setup

1. Sign up at [resend.com](https://resend.com)
2. Add and verify your sending domain
3. Create an API key → `RESEND_API_KEY`
4. Set `RESEND_FROM_EMAIL` to a verified address on your domain

---

## Production Deployment

### Recommended: Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard or via CLI:
vercel env add NEXTAUTH_SECRET production
vercel env add DATABASE_URL production
# ... (repeat for all variables)
```

> **Database note:** SQLite (`dev.db`) is not suitable for production on serverless/distributed environments. Migrate to **PostgreSQL** (PlanetScale, Supabase, Neon, or Railway) before going live.

### PostgreSQL Migration

1. Update `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

2. Remove the `better-sqlite3` adapter from `src/lib/prisma.ts`:
```ts
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

3. Set `DATABASE_URL` to your PostgreSQL connection string

4. Run migrations:
```bash
npx prisma migrate deploy
npx prisma db seed
```

### Other Platforms (Railway, Render, Fly.io)

1. Connect your Git repository
2. Set all environment variables from `.env`
3. Build command: `npm run build`
4. Start command: `npm start`
5. Set `NEXTAUTH_URL` to your deployed domain
6. Set `NEXT_PUBLIC_APP_URL` to your deployed domain

---

## Post-Deployment Checklist

```
[ ] Changed admin password (admin@sovereignml.com)
[ ] NEXTAUTH_URL set to production domain
[ ] NEXT_PUBLIC_APP_URL set to production domain
[ ] AUTH_TRUST_HOST=true set (for proxied deployments)
[ ] Stripe webhook endpoint registered
[ ] All Stripe price IDs filled in
[ ] RESEND_FROM_EMAIL verified with Resend
[ ] Google OAuth redirect URI updated for production domain
[ ] Database migrated from SQLite to PostgreSQL
[ ] INSTANCE_ENCRYPTION_KEY set (32 bytes, base64)
[ ] NEXTAUTH_SECRET set (32+ byte random string)
```

---

## Database Management

### View data in Prisma Studio

```bash
npx prisma studio
```

Opens at: [http://localhost:5555](http://localhost:5555)

### Re-seed after schema changes

```bash
npx prisma db push
npx prisma db seed
```

### Create a migration (PostgreSQL)

```bash
npx prisma migrate dev --name "describe_change"
```

---

## Custom Domain + SSL

SovereignML is designed to run at `sovereignml.com`. To deploy under a different domain:

1. Update `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL`
2. Update `src/configs/branding.ts` → `domain`
3. Update Google OAuth redirect URI in Cloud Console
4. Update Stripe webhook endpoint URL
5. Update Resend sending domain

---

## Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | SQLite file path or PostgreSQL URL |
| `NEXTAUTH_URL` | ✅ | Full URL of your deployment |
| `NEXTAUTH_SECRET` | ✅ | Random 32+ byte secret for JWT signing |
| `AUTH_TRUST_HOST` | ✅ | Set `true` for proxied/cloud deployments |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth client secret |
| `STRIPE_SECRET_KEY` | Optional* | Stripe API key (`sk_live_...` or `sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Optional* | Stripe webhook signing secret |
| `STRIPE_PRICE_*` | Optional* | Stripe Price IDs for each plan/interval |
| `RESEND_API_KEY` | Optional | Resend API key for transactional email |
| `RESEND_FROM_EMAIL` | Optional | Verified sender address |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public-facing app URL (for email links) |
| `INSTANCE_ENCRYPTION_KEY` | ✅ | Base64-encoded 32-byte key for AES-256-GCM |

*Stripe variables are optional in development — the platform auto-activates deployments without them. Required in production.

---

## Troubleshooting

### Auth not working / redirect loops
- Ensure `NEXTAUTH_URL` exactly matches your deployment URL (including `https://`)
- Set `AUTH_TRUST_HOST=true` if behind a proxy/load balancer

### Prisma client error: "Module has no exported member"
```bash
npx prisma generate
```

### Database not in sync
```bash
npx prisma db push
```

### Email not sending
- Check `RESEND_API_KEY` is set
- Verify your sending domain in Resend dashboard
- Check logs for: `RESEND_API_KEY not set — skipping email send`

### Stripe webhook not receiving events
- Ensure webhook URL is publicly accessible (not localhost without CLI forwarding)
- Check `STRIPE_WEBHOOK_SECRET` matches the signing secret in Stripe Dashboard
- Use `stripe listen` CLI for local testing
