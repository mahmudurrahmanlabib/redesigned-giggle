import crypto from "node:crypto"
import type { InferSelectModel } from "drizzle-orm"
import { instances } from "@/db"
import { routeModel } from "@/lib/model-router"

type Instance = InferSelectModel<typeof instances>
import type { BudgetTier } from "@/lib/agent-config"

export const OPENCLAW_IMAGE = () =>
  process.env.OPENCLAW_IMAGE || "openclaw/openclaw:latest"

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
 * Render the docker-compose.yml that runs on the agent VPS.
 * OpenClaw listens on 8080 inside the caddy network; Caddy exposes 80/443.
 */
export function renderComposeFile(opts: { image?: string } = {}): string {
  const image = opts.image ?? OPENCLAW_IMAGE()
  return `services:
  openclaw:
    image: ${image}
    restart: always
    env_file: .env
    expose:
      - "8080"
    networks:
      - web
  caddy:
    image: caddy:2-alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - openclaw
    networks:
      - web
networks:
  web: {}
volumes:
  caddy_data: {}
  caddy_config: {}
`
}

/**
 * Caddy issues Let's Encrypt automatically once DNS resolves.
 * If no domain is provided we fall back to serving on :80 on the server IP.
 */
export function renderCaddyfile(args: { domain?: string | null }): string {
  if (args.domain && args.domain.trim().length > 0) {
    return `${args.domain} {
  reverse_proxy openclaw:8080
}
`
  }
  return `:80 {
  reverse_proxy openclaw:8080
}
`
}

export function renderDotenv(env: OpenclawEnv): string {
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
