# Backend TODO

Tracker for UI shipped this sprint whose backend wiring is pending. All UI pages currently render with dummy data and display an amber warning chip.

Priority key: **P0** = ship first, **P1** = ship after P0, **P2** = nice-to-have.

---

## Pipeline Core (from earlier plan)

| # | Item | Priority | Notes |
|---|---|---|---|
| 1 | Prisma schema delta (`Instance` + `User.credits` + `UsageEvent` + `BotGateway` + `BotHealth` + `Skill`) | P0 | migration: `add_agent_fields_and_credits` |
| 2 | `src/lib/agent-config.ts` — zod schema + serverless normalization rule | P0 | Flow 2 |
| 3 | `src/lib/soul.ts::generateSoul()` | P0 | Flow 3 |
| 4 | `src/configs/skill-map.ts` + registry seed | P0 | Flow 4 |
| 5 | `src/lib/model-router.ts::routeModel()` | P0 | Flow 5 |
| 6 | `src/lib/provisioner.ts` + `OPENCLAW_ORCHESTRATOR_URL` | P0 | Flow 6–7 |
| 7 | `src/app/api/deploy/route.ts` — extend with soul/skills/model/token/gateway | P0 | Flow 6 |
| 8 | `src/app/api/instances/[id]/{restart,delete,token}/route.ts` — wire to provisioner | P0 | Flow 10 |
| 9 | `src/app/api/instances/[id]/interfaces/connect/route.ts` | P0 | Flow 8 — Telegram immediate/deferred, Discord, Slack |
| 10 | `src/app/api/usage/ingest/route.ts` + `src/lib/credits.ts` | P0 | Flow 11 |
| 11 | Stripe webhook: `grantCredits` on `invoice.paid` | P0 | Flow 11 |
| 12 | `src/app/api/health/beat/route.ts` | P1 | Flow 12 |
| 13 | Uptime Kuma integration + `GET /api/monitoring/summary` | P1 | Flow 12 |
| 14 | Gateway proxy — `proxy.ts` or `src/app/api/gateway/[...path]/route.ts` | P1 | Flow 9 |
| 15 | Custom domain verification flow (CNAME + TXT) | P2 | Flow 9 |
| 16 | Skills install/uninstall endpoints | P1 | Flow 10 |

---

## Instance Detail (`/dashboard/instances/[id]`)

| Item | Priority | Needs |
|---|---|---|
| Overview health values (`BotHealth`) | P0 | Flow 12 |
| Overview credits burn rate | P0 | Flow 11 |
| Controls: Restart/Stop/Delete buttons | P0 | `/api/instances/[id]/{restart,delete}` |
| Controls: Reveal/Rotate bot token | P0 | `/api/instances/[id]/token` |
| AI Config: model tier/temp/maxTokens persistence | P0 | `PUT /api/instances/[id]/config` |
| AI Config: SOUL.md inline editor save | P1 | `PUT /api/instances/[id]/soul` |
| Interfaces tab connect/reconfigure/unbind per kind | P0 | Flow 8 |
| Skills tab install/uninstall | P1 | `POST /api/instances/[id]/skills/{install,uninstall}` |
| Monitoring tab live data | P1 | Uptime Kuma API |
| Usage tab real events | P0 | `UsageEvent` read |
| **Logs tab** (streaming tail + level filter) | P1 | `GET /api/instances/[id]/logs?stream=sse` |
| **Env vars** editor (AI Config tab) | P1 | `PUT /api/instances/[id]/env` — KMS-encrypted at rest |
| **Webhooks** tab | P1 | `Webhook` model + CRUD + dispatcher |
| **Danger zone** (Delete confirm modal) | P0 | delete endpoint |

---

## Dashboard Global

| Item | Priority | Needs |
|---|---|---|
| Overview aggregation (total agents, credits, spend, last incident) | P0 | `GET /api/dashboard/summary` |
| Instances search + filter | P1 | client-side only, no backend |
| **API keys** (`/dashboard/api-keys`) | P1 | `ApiKey` model + CRUD; hash at rest |
| **Team / seats** (`/dashboard/team`) | P2 | `Team`, `Membership`, `Invite` models; RBAC |
| **Audit log** (`/dashboard/audit-log`) | P1 | `AuditEvent` model + writer middleware |

---

## Deploy Wizard

| Item | Priority | Needs |
|---|---|---|
| Templates / presets | P1 | pure client config — no backend |
| Clone from existing instance | P1 | `GET /api/instances/[id]` prefill |
| Cost preview per budget tier | P1 | client estimation from heuristics + plan limits |
| Regions status strip | P1 | Uptime Kuma region probes |

---

## Billing

| Item | Priority | Needs |
|---|---|---|
| Invoices list + PDF | P0 | `stripe.invoices.list` + proxy download |
| **Top-up credits** button | P1 | `POST /api/billing/topup` → Stripe checkout `mode=payment` |
| **Usage alerts** (50/80/95%) | P1 | `UsageAlert` model + cron evaluator + email |

---

## Marketing / Trust

| Item | Priority | Needs |
|---|---|---|
| `/status` public page | P1 | Uptime Kuma public API read-through |
| `/changelog` | P1 | markdown-sourced, no backend |
| Docs search (CMD+K) | P2 | client-side MiniSearch index build |
| **Landing playground** chat | P1 | scoped bot token + rate-limited proxy to `/api/chat/demo` |

---

## Auth / Account

| Item | Priority | Needs |
|---|---|---|
| 2FA toggle | P1 | TOTP secret + `User.twoFactorSecret` + recovery codes |
| Active sessions list + sign-out-all | P1 | NextAuth sessions table queries |
| Delete account | P1 | `DELETE /api/account` — hard delete + cancel all subs |

---

## Shipped Frontend (this sprint)

- Deploy wizard: Purpose + Capability intake steps; serverless skips infra; Telegram immediate/deferred
- Instance detail `/dashboard/instances/[id]` with 7-tab layout + gateway URL + access URL cards
- Top-level `/dashboard/monitoring` global uptime table
- Public pages: `/status`, `/changelog`
- Dashboard pages: `/dashboard/api-keys`, `/dashboard/audit-log`, `/dashboard/team`
- Dashboard overview: 4 stats + 3 quick actions
- Deploy wizard: template picker, per-tier cost preview, regions status strip
- Instance detail tabs: Logs, Webhooks, Env Vars, Danger Zone (with typed confirm)
- Billing: Top Up Credits, Usage Alerts, Invoices list with PDF buttons
- Account: 2FA toggle, Active Sessions, Delete Account danger section
- Instances list: search + status filter client component
- Landing page: live Playground chat widget (canned responses)
- All dummy data clearly marked with amber "⚠ backend pending" chips
