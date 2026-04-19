# P0 Execution Plan — Bot Factory Backend

Locked decisions (from intake):
- **Bot runtime**: ship a minimal stub in `/bot-runtime/`, dockerized, pushed to GHCR.
- **Deploy model**: hybrid — shared/serverless tiers run as Docker containers on a shared Linode fleet; `vps` tier provisions a dedicated Linode VM.
- **DB**: stay on SQLite; JSON columns serialized as TEXT.
- **Interfaces**: Web + Telegram. Discord/Slack deferred.
- **Orchestration**: web app SSHes into hosts, runs `docker` directly.
- **Gateway**: path-based via web app (`/g/<id8>/...`), domain configurable via env.
- **Image registry**: GHCR.
- **Bot codebase**: sibling dir `/bot-runtime/` in this repo.
- **Models**: low+mid free OpenRouter, high paid `anthropic/claude-3.5-sonnet`.
- **Telegram**: centralized through web app at `/tg/<botToken>`.
- **Linode default**: Newark + g6-standard-2 for shared hosts.
- **Credits/period**: Free=1k · Pro=20k · Scale=100k.
- **Bootstrap**: `pnpm bootstrap:host` script.
- **SSH key**: fresh `sovereign_fleet_ed25519` keypair.
- **Domain**: localhost for dev, env-configurable.
- **Credentials**: I ship `.env.example`; user fills.

---

## Phase 0 — Plumbing (no behavior change)

**File:** `.env.example` (extend existing)
- Add `LINODE_API_TOKEN`, `OPENROUTER_API_KEY`, `SSH_FLEET_PRIVATE_KEY`, `SSH_FLEET_PUBLIC_KEY`, `BOT_RUNTIME_IMAGE`, `NEXT_PUBLIC_GATEWAY_BASE_URL`, `OPENCLAW_ORCHESTRATOR_URL` (kept as future hook, default unset).

**File:** `package.json`
- Add deps: `@linode/api-v4`, `node-ssh`, `otplib` (for later 2FA).
- Add scripts: `bootstrap:host`, `build:bot-runtime`.

---

## Phase 1 — Schema delta (#1)

**File:** `prisma/schema.prisma`

```prisma
model User {
  // ... existing
  credits   Int @default(0)
  usageEvents UsageEvent[]
  creditLedger CreditLedger[]
}

model Plan {
  // ... existing
  creditsPerPeriod Int @default(0)
}

model Instance {
  // ... existing
  agentType         String?
  agentConfig       Json?
  soulMd            String?
  skills            Json?
  modelTier         String?
  botToken          String?  @unique
  lastActiveAt      DateTime?
  deploymentTarget  String?   // "vps" | "shared" | "serverless"
  interfaceKind     String?   // "web" | "telegram"
  telegramBotToken  String?   // encrypted
  telegramUsername  String?
  botHostId         String?
  containerPort     Int?
  botHost           BotHost?  @relation(fields: [botHostId], references: [id])
  usageEvents       UsageEvent[]
}

model BotHost {
  id            String   @id @default(cuid())
  label         String
  linodeId      Int      @unique
  ipAddress     String
  region        String
  plan          String   // linode plan slug
  capacity      Int      @default(15)  // soft cap on containers
  status        String   @default("ready")  // ready | draining | offline
  createdAt     DateTime @default(now())
  instances     Instance[]
}

model UsageEvent {
  id          String   @id @default(cuid())
  instanceId  String
  userId      String
  kind        String   // "request" | "tokens_in" | "tokens_out"
  amount      Int
  meta        Json?
  createdAt   DateTime @default(now())
  instance    Instance @relation(fields: [instanceId], references: [id], onDelete: Cascade)
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([instanceId, createdAt])
  @@index([userId, createdAt])
}

model CreditLedger {
  id        String   @id @default(cuid())
  userId    String
  delta     Int      // positive = grant, negative = consume
  reason    String   // "subscription:pro:2026-04" | "topup:cs_xxx" | "consume:inst_xxx"
  balance   Int
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, createdAt])
}
```

Migration: `pnpm prisma migrate dev --name add_agent_fields_and_credits`

---

## Phase 2 — Pure-function libs (no infra needed)

| File | Exports | Notes |
|---|---|---|
| `src/lib/agent-config.ts` | `AgentConfigSchema` (zod), `normalizeAgentConfig(cfg)` | Strips infra fields when `deploymentTarget!=="vps"` |
| `src/lib/soul.ts` | `generateSoul(cfg, skills): string` | Deterministic markdown |
| `src/configs/skill-map.ts` | `SKILL_MAP`, `selectSkills(cfg)` | Maps every `AGENT_CATEGORIES` slug |
| `src/lib/model-router.ts` | `routeModel(tier)` | low: `meta-llama/llama-3.2-3b-instruct:free`; mid: `google/gemini-2.0-flash-exp:free`; high: `anthropic/claude-3.5-sonnet`; all via OpenRouter |
| `src/lib/credits.ts` | `grantCredits(userId, amount, reason)`, `consumeCredits(userId, amount, reason)`, `getBalance(userId)` | Atomic Prisma `$transaction` |
| `src/lib/crypto-secret.ts` | `encryptSecret(s)`, `decryptSecret(s)` | AES-256-GCM, key from `SECRET_ENCRYPTION_KEY` env |

---

## Phase 3 — Bot runtime (`/bot-runtime/`)

**New directory, new package:**
```
/bot-runtime
  Dockerfile
  package.json
  tsconfig.json
  src/
    index.ts         # express server
    chat.ts          # OpenRouter client + SOUL.md system prompt
    telegram.ts      # POST /telegram handler (Telegram update → /chat → sendMessage)
    usage.ts         # POST events to USAGE_INGEST_URL
```

Env contract:
- `BOT_TOKEN` — auth header expected on `/chat`
- `SOUL_MD` — markdown persona (loaded from env, big string OK)
- `MODEL` — primary OpenRouter model id
- `FALLBACK_MODEL` — secondary
- `OPENROUTER_API_KEY` — shared key (we eat the cost on free tier)
- `USAGE_INGEST_URL` — `https://app.sovereignml.ai/api/usage/ingest`
- `INSTANCE_ID` — for usage tagging
- `TELEGRAM_BOT_TOKEN` — optional; if set, also handles `/telegram`
- `PORT` — listen port (assigned by provisioner)

CI: `.github/workflows/bot-runtime.yml` — on push to `bot-runtime/**`, build + push `ghcr.io/<owner>/sovereign-bot-runtime:<sha>` and `:latest`.

---

## Phase 4 — Linode + SSH plumbing

| File | Exports | Notes |
|---|---|---|
| `src/lib/linode.ts` | `linodeCreateVM`, `linodeDeleteVM`, `linodeGetVM` | Thin wrapper on `@linode/api-v4` |
| `src/lib/ssh.ts` | `sshRun(host, cmd)`, `sshDockerRun(host, opts)`, `sshDockerStop`, `sshDockerRm`, `sshDockerRestart` | Uses `node-ssh` with `SSH_FLEET_PRIVATE_KEY` |
| `src/lib/host-scheduler.ts` | `pickHost(): BotHost` | Returns least-loaded `ready` host; throws if fleet full |

**StackScript** (Linode boot script for shared hosts):
```bash
#!/bin/bash
apt-get update -y && apt-get install -y docker.io
mkdir -p /root/.ssh
echo "$SSH_FLEET_PUBLIC_KEY" >> /root/.ssh/authorized_keys
systemctl enable --now docker
```
Stored as a constant in `src/lib/linode.ts`.

---

## Phase 5 — Provisioner (#6, #7)

**File:** `src/lib/provisioner.ts`

```ts
export async function provisionBot(instance: Instance): Promise<{ ipAddress, port, botHostId? }>
export async function restartBot(instance: Instance): Promise<void>
export async function deleteBot(instance: Instance): Promise<void>
export async function pauseBot(instance: Instance): Promise<void>
export async function resumeBot(instance: Instance): Promise<void>
```

Branch on `instance.deploymentTarget`:
- **`shared` / `serverless`**:
  1. `pickHost()` → BotHost
  2. Allocate port (4000–5999 range, check existing instances on host)
  3. SSH `docker pull <BOT_RUNTIME_IMAGE>`
  4. SSH `docker run -d --name bot_<id> -p <port>:3000 -e BOT_TOKEN=... -e SOUL_MD=... -e MODEL=... -e OPENROUTER_API_KEY=... -e USAGE_INGEST_URL=... -e INSTANCE_ID=... <BOT_RUNTIME_IMAGE>`
  5. Update Instance: `botHostId`, `containerPort`, `ipAddress`=host IP, `status=running`
- **`vps`**:
  1. Linode API: create VM (`g6-standard-1` for entry tiers, mapped from `serverConfig`), region `us-east`, with stack script
  2. Poll until `running`
  3. SSH `docker run` (same as above) on port 80→3000
  4. Update Instance: `ipAddress`, `status=running`

Dev fallback: if `LINODE_API_TOKEN` unset → mock IP (existing behavior preserved).

---

## Phase 6 — Deploy pipeline extension (#2)

**File:** `src/app/api/deploy/route.ts`

After existing `Instance` create + Stripe checkout setup:
1. Parse `body.agentConfig` with zod schema.
2. `skills = selectSkills(cfg)`
3. `soul = generateSoul(cfg, skills)`
4. `model = routeModel(cfg.budget_tier)`
5. `botToken = "sk_bot_" + crypto.randomBytes(24).toString("hex")`
6. Update Instance with all of the above + `deploymentTarget`, `interfaceKind`, `agentType`.
7. **In dev mode** (no Stripe / auto-activate path): immediately call `provisionBot(instance)`.
8. **In paid mode**: defer provision to webhook `checkout.session.completed` handler.

**File:** `src/lib/stripe-events.ts`
- `handleCheckoutSessionCompleted` already mocks IP; replace with `await provisionBot(instance)`.
- `handleInvoicePaid` already flips status; **add** `await grantCredits(userId, plan.creditsPerPeriod, ...)`.

---

## Phase 7 — Lifecycle endpoints (#7, #8, #13, #14)

| File | Method | Action |
|---|---|---|
| `src/app/api/instances/[instanceId]/restart/route.ts` | POST | `await restartBot(instance)` |
| `src/app/api/instances/[instanceId]/delete/route.ts` | POST | `await deleteBot(instance)` + cancel sub |
| `src/app/api/instances/[instanceId]/token/route.ts` | GET | return botToken (owner only) |
| `src/app/api/instances/[instanceId]/token/route.ts` | POST | rotate token + push new env via SSH + restart container |
| `src/app/api/instances/[instanceId]/route.ts` | DELETE | delete (alias of /delete POST for REST cleanliness) |

**Client wiring:**
- `src/app/dashboard/instances/[id]/instance-tabs.tsx`:
  - Controls tab buttons → `useTransition` + fetch + `toast` + `router.refresh()`
  - Token Reveal/Rotate → fetch + clipboard
  - Danger zone "I understand, delete" → fetch DELETE + `router.push("/dashboard/instances")`

---

## Phase 8 — Interface binding: Telegram (#9 partial)

**File:** `src/app/api/instances/[instanceId]/interfaces/connect/route.ts`
- Body: `{ kind: "telegram", token }`
- `getMe` to validate
- Set webhook: `https://api.telegram.org/bot<token>/setWebhook?url=<gateway>/tg/<botToken>`
- Encrypt + persist `telegramBotToken`, `telegramUsername`
- Push new env to bot via SSH (restart)

**File:** `src/app/tg/[botToken]/route.ts` (gateway-style)
- Receives Telegram update
- Look up Instance by `botToken`
- Forward to bot's internal URL (`http://<host_ip>:<port>/telegram`) with the update body

---

## Phase 9 — Gateway proxy

**File:** `src/app/g/[id8]/[...path]/route.ts`
- Catch-all
- Look up Instance by `id8` (first 8 chars of id)
- Proxy fetch to `http://<host_ip>:<port>/<path>` with body + headers
- Add `X-Bot-Token` header
- Pass through response stream

`NEXT_PUBLIC_GATEWAY_BASE_URL` defaults to `http://localhost:3002` in dev.

---

## Phase 10 — Usage ingest + credits (#10, #11)

**File:** `src/app/api/usage/ingest/route.ts`
- Auth via `X-Bot-Token` header → look up Instance
- Body: `{ kind, amount, meta? }`
- Insert `UsageEvent`
- `consumeCredits(instance.userId, computeCreditCost(kind, amount))`
- If new balance ≤ 0 → `pauseBot(instance)` + Instance.status=`stopped`

**File:** `src/lib/credits.ts` (already in Phase 2) — wires `grantCredits` for both subscription renewals and one-time top-ups (Phase 11).

---

## Phase 11 — Top-up + Stripe extras (deferred to Sprint 2 but plan)

`POST /api/billing/topup` → Stripe checkout `mode=payment` with metadata `{ kind: "credit_topup", credits, userId }`. Webhook `checkout.session.completed` for `kind=credit_topup` → `grantCredits(userId, credits, "topup:" + sessionId)`.

---

## Phase 12 — Dashboard summary (#12)

**File:** `src/app/api/dashboard/summary/route.ts`
- Aggregates: instance counts by status, current credits, last 30d usage sum, last incident from `InstanceLog` where `level="error"`.

`src/app/dashboard/page.tsx` swaps the four hardcoded stat cards for real values.

---

## Phase 13 — Bootstrap script

**File:** `scripts/bootstrap-shared-host.ts`
- Reads `LINODE_API_TOKEN`, `SSH_FLEET_PUBLIC_KEY` from env
- Linode API: create `g6-standard-2` in `us-east` with the StackScript
- Poll until SSH is reachable
- SSH-test: `docker --version` returns
- Insert `BotHost` row in DB
- Print: `✓ BotHost bh_xxx ready at <ip>`

`pnpm bootstrap:host` runs it. Idempotent (checks for existing `BotHost` rows in same region with capacity).

---

## Risk / Open Questions

1. **OpenRouter free-tier rate limits** — ~20 req/min/key. We share one key across all bots in dev. May trip in load tests. Mitigation: route through key per host or upgrade tier when revenue justifies.
2. **SSH parallelism** — concurrent docker runs on same host can race on port allocation. Mitigation: serialize provisions per host with a Postgres advisory lock (or in-process mutex on SQLite for dev).
3. **Image pull cold start** — first deploy on a fresh host pulls ~150MB image. Adds ~30s. Mitigation: pre-pull on bootstrap.
4. **Telegram webhook on localhost** — Telegram requires public HTTPS. For dev testing of Telegram flow specifically, user will need ngrok or a tunnel; Web Chat works on pure localhost. Documented in `.env.example`.
5. **Stripe mode** — existing flow has dev auto-activate. Provision will fire in dev path; in prod path, only after payment.
6. **`AGENT_CATEGORIES` vs new `agentType`** — they share slugs. Audit needed; harmonize in Phase 2.

## Order of execution (chronological)

1. Phase 0 (env, deps) — 30 min
2. Phase 1 (schema + migration) — 1 h
3. Phase 2 (pure libs + tests) — 3 h
4. Phase 3 (bot runtime) — 4 h
5. Phase 4 (linode + ssh) — 2 h
6. Phase 5 (provisioner) — 3 h
7. Phase 6 (deploy pipeline) — 2 h
8. Phase 7 (lifecycle + UI wiring) — 3 h
9. Phase 8 (telegram binding) — 3 h
10. Phase 9 (gateway proxy) — 1 h
11. Phase 10 (usage + credits) — 2 h
12. Phase 11 (top-up Stripe — deferred) — n/a
13. Phase 12 (dashboard summary) — 1 h
14. Phase 13 (bootstrap script) — 1 h

**Total: ~26h of build, spread across the P0 list.** Achievable in 2 working days if focused; 3 calendar days realistic.

## What I need from you (in order, but only when reached)

1. **Now**: nothing — Phases 0–4 only need your repo. I can start.
2. **Before Phase 5 ships end-to-end**: `LINODE_API_TOKEN` in `.env.local`, `SSH_FLEET_PRIVATE_KEY` + `SSH_FLEET_PUBLIC_KEY` (I'll provide a one-liner to generate).
3. **Before bot runtime ships to GHCR**: GitHub PAT with `write:packages` OR you push the workflow yourself once I commit it.
4. **Before Phase 6 dev-tests**: `OPENROUTER_API_KEY` in `.env.local`.
5. **Before Phase 11**: nothing extra; Stripe keys already in env.
6. **For Telegram dev test**: ngrok URL (optional, can defer).

## Definition of Done

- `pnpm bootstrap:host` provisions a real Linode VM in your account.
- Walk wizard end-to-end → Instance row populated with `agentConfig`, `soulMd`, `skills`, `modelTier`, `botToken`, `containerPort`, `botHostId`.
- `curl http://localhost:3002/g/<id8>/health` returns `200`.
- `curl -X POST http://localhost:3002/g/<id8>/chat -d '{"message":"hi"}' -H "X-Bot-Token: ..."` returns an OpenRouter completion.
- Restart button restarts the container.
- Delete button stops + removes the container, marks Instance deleted.
- After a chat: `UsageEvent` row exists, `User.credits` decremented, `CreditLedger` row written.
- Stripe test webhook for `invoice.paid` grants credits per plan.
- Dashboard overview shows real numbers.
- `npx tsc --noEmit -p .` zero errors. `npx next build` succeeds.
