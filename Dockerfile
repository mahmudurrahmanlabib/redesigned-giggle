# syntax=docker/dockerfile:1.7

# ──────────────────────────────────────────────────────────────────────────────
# Stage 1 — deps: install full node_modules (includes native builds for ssh2)
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Native-build deps for ssh2 / cpu-features / bcrypt.
RUN apk add --no-cache python3 make g++ openssh-client libc6-compat

COPY package.json package-lock.json* ./
# Generate Prisma client during install (postinstall hook) — needs schema now.
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# ──────────────────────────────────────────────────────────────────────────────
# Stage 2 — builder: compile Next.js + generate Prisma client
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Regenerate Prisma client against the current schema (produces into
# node_modules/.prisma — copied forward in the runtime stage).
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
# Build-time stub so Prisma client import doesn't fail on URL parsing.
# No queries run during build (all DB-touching pages are force-dynamic);
# real DATABASE_URL is injected at container runtime via docker-compose.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"
RUN npm run build

# ──────────────────────────────────────────────────────────────────────────────
# Stage 3 — runtime: minimal image with only the standalone server + public
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Runtime deps: openssl for Prisma, libc6-compat for native addons.
RUN apk add --no-cache libc6-compat openssl tini \
 && addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone Next.js server (includes minimal node_modules).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma needs the schema + migrations + config at runtime for `prisma migrate deploy`.
# Prisma 7 requires datasource.url to be in prisma.config.ts (not schema.prisma).
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Entrypoint: wait for DB → run migrations → exec server.
COPY --chown=nextjs:nodejs docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER nextjs
EXPOSE 3000

# tini reaps zombies and forwards signals correctly for clean shutdown.
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
