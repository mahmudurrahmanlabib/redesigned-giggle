import type { BudgetTier } from "@/lib/agent-config"

export type ModelRoute = {
  provider: "openrouter"
  model: string
  fallback: string
  apiKeyEnv: "OPENROUTER_API_KEY"
}

/**
 * Per-tier model routing. All tiers share a single OpenRouter endpoint so the
 * bot runtime only needs one client. Low + mid default to free models; high
 * uses a paid premium model. Fallback is always a free model so outages or
 * rate limits on the primary don't hard-fail the bot.
 *
 * When the product ships multi-provider, swap this to return a chain instead
 * of a single route; the runtime's retry loop is already compatible.
 */
export function routeModel(tier: BudgetTier): ModelRoute {
  switch (tier) {
    case "low":
      return {
        provider: "openrouter",
        model: "meta-llama/llama-3.2-3b-instruct:free",
        fallback: "google/gemini-2.0-flash:free",
        apiKeyEnv: "OPENROUTER_API_KEY",
      }
    case "mid":
      return {
        provider: "openrouter",
        model: "google/gemini-2.0-flash:free",
        fallback: "meta-llama/llama-3.2-3b-instruct:free",
        apiKeyEnv: "OPENROUTER_API_KEY",
      }
    case "high":
      return {
        provider: "openrouter",
        model: "anthropic/claude-3.5-sonnet",
        fallback: "google/gemini-2.0-flash:free",
        apiKeyEnv: "OPENROUTER_API_KEY",
      }
  }
}
