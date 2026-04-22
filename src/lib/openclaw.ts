import crypto from "node:crypto"
import type { InferSelectModel } from "drizzle-orm"
import { instances } from "@/db"
import { routeModel } from "@/lib/model-router"

type Instance = InferSelectModel<typeof instances>
import type { BudgetTier } from "@/lib/agent-config"

const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"

export function generateAdminPassword(length = 24): string {
  let out = ""
  const bytes = crypto.randomBytes(length)
  for (let i = 0; i < length; i++) {
    out += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length]
  }
  return out
}

export function generateGatewayToken(length = 32): string {
  return crypto.randomBytes(length).toString("hex")
}

export const OPENCLAW_VERSION = () =>
  process.env.OPENCLAW_VERSION || "latest"

export const OPENCLAW_GATEWAY_PORT = 18789
export const OPENCLAW_SERVICE_NAME = "openclaw-gateway"

export type OpenclawEnv = Record<string, string>

export function buildOpenclawEnv(args: {
  instance: Instance
  adminEmail: string
  adminPassword: string
  openRouterApiKey: string
}): OpenclawEnv {
  const tier = (args.instance.modelTier ?? "mid") as BudgetTier
  const route = routeModel(tier)

  const env: OpenclawEnv = {
    DOMAIN: args.instance.domain ?? "",
    OPENROUTER_API_KEY: args.openRouterApiKey,
    OPENCLAW_ADMIN_EMAIL: args.adminEmail,
    OPENCLAW_ADMIN_PASSWORD: args.adminPassword,
    OPENCLAW_MODEL: route.model,
    OPENCLAW_FALLBACK_MODEL: route.fallback,
    OPENCLAW_LLM_PROVIDER: "openrouter",
    OPENCLAW_LLM_BASE_URL: "https://openrouter.ai/api/v1",
    INSTANCE_ID: args.instance.id,
  }
  return env
}

/**
 * Generate OpenClaw Gateway openclaw.json config.
 * Uses the current schema: bind modes (not IPs), agents.defaults.model
 * with primary/fallbacks, and agent list entries with `id`.
 * OpenRouter API key is passed via env var (in .env), not in config.
 */
export function renderOpenclawConfig(args: {
  gatewayToken: string
  openRouterApiKey: string
  model: string
  fallbackModel: string
  soulMd?: string | null
}): string {
  return `{
  gateway: {
    port: ${OPENCLAW_GATEWAY_PORT},
    bind: "lan",
    auth: {
      token: ${JSON.stringify(args.gatewayToken)},
    },
  },
  agents: {
    defaults: {
      model: {
        primary: ${JSON.stringify(args.model)},
        fallbacks: [${JSON.stringify(args.fallbackModel)}],
      },
    },
    list: [
      { id: "main" },
    ],
  },
}
`
}

/**
 * Caddy reverse-proxies to the OpenClaw Gateway on loopback.
 * With a domain, Caddy auto-provisions Let's Encrypt TLS.
 * Without a domain, Caddy serves HTTP on :80.
 */
export function renderCaddyfile(args: { domain?: string | null }): string {
  if (args.domain && args.domain.trim().length > 0) {
    return `${args.domain} {
  reverse_proxy localhost:${OPENCLAW_GATEWAY_PORT}
}
`
  }
  return `:80 {
  reverse_proxy localhost:${OPENCLAW_GATEWAY_PORT}
}
`
}

/**
 * systemd unit for the OpenClaw Gateway daemon.
 * Runs as the dedicated `openclaw` user created by the StackScript.
 */
export function renderSystemdUnit(): string {
  return `[Unit]
Description=OpenClaw Gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=openclaw
Group=openclaw
WorkingDirectory=/opt/openclaw
EnvironmentFile=/opt/openclaw/.env
Environment=NODE_COMPILE_CACHE=/var/tmp/openclaw-compile-cache
Environment=OPENCLAW_NO_RESPAWN=1
Environment=HOME=/opt/openclaw
ExecStart=/usr/bin/openclaw gateway --allow-unconfigured
Restart=always
RestartSec=2
TimeoutStartSec=90

[Install]
WantedBy=multi-user.target
`
}

export function renderEnvFile(env: OpenclawEnv): string {
  return (
    Object.entries(env)
      .map(([k, v]) => `${k}=${dotenvEscape(v)}`)
      .join("\n") + "\n"
  )
}

function dotenvEscape(value: string): string {
  if (value === "") return ""
  if (/[\s"'$`\\]/.test(value)) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
  }
  return value
}
