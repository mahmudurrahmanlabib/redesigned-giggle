// Subscription tier metadata. Drives the landing page pricing grid + seed.
// Stripe price IDs are filled in by the user when they wire real Stripe keys.

export type PlanTier = "starter" | "pro" | "enterprise"

export type PlanConfig = {
  slug: string
  tier: PlanTier
  name: string
  description: string
  features: string[]
  // Stripe price IDs (set in env when wiring Stripe). Left empty for dev.
  stripePriceIdMonthly: string
  stripePriceIdYearly: string
  isActive: boolean
  sortOrder: number
  // Display-only "starting at" price for the landing page grid.
  // The real charge is per-instance (server type + storage).
  displayPriceMonthly: number
  highlight?: boolean
}

export const PLANS: readonly PlanConfig[] = [
  {
    slug: "starter",
    tier: "starter",
    name: "Starter",
    description: "For solo developers launching their first AI agent.",
    features: [
      "1 active AI agent",
      "Standard compute",
      "Community support",
      "Basic monitoring",
      "Daily health checks",
    ],
    stripePriceIdMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "",
    stripePriceIdYearly: process.env.STRIPE_PRICE_STARTER_YEARLY ?? "",
    isActive: true,
    sortOrder: 10,
    displayPriceMonthly: 5,
  },
  {
    slug: "pro",
    tier: "pro",
    name: "Pro",
    description: "For teams running production AI agents at scale.",
    features: [
      "Up to 10 AI agents",
      "All agent types",
      "Priority email support",
      "Advanced monitoring & alerts",
      "Hourly health checks",
      "Custom configurations",
      "Managed optimization",
    ],
    stripePriceIdMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
    stripePriceIdYearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? "",
    isActive: true,
    sortOrder: 20,
    displayPriceMonthly: 29,
    highlight: true,
  },
  {
    slug: "enterprise",
    tier: "enterprise",
    name: "Enterprise",
    description: "For organizations running mission-critical AI operations.",
    features: [
      "Unlimited AI agents",
      "Custom agent builds",
      "Dedicated success engineer",
      "24/7 phone + Slack support",
      "Custom SLAs",
      "Real-time agent health monitoring",
      "Bring-your-own infrastructure",
      "SOC2 + audit logs",
    ],
    stripePriceIdMonthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY ?? "",
    stripePriceIdYearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY ?? "",
    isActive: true,
    sortOrder: 30,
    displayPriceMonthly: 199,
  },
] as const

export function findPlanBySlug(slug: string): PlanConfig | undefined {
  return PLANS.find((p) => p.slug === slug)
}
