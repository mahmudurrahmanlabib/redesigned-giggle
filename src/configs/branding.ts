// Single source of truth for product identity. Edit here, propagates everywhere.

export const BRANDING = {
  name: "SovereignML",
  shortName: "SovereignML",
  tagline: "Deploy. Configure. Optimize.",
  subtagline: "Your AI infrastructure, fully managed.",
  description:
    "SovereignML is the AI operations layer on top of your infrastructure. Deploy OpenClaw in one click, then let us configure, maintain, and optimize it for you.",
  domain: "sovereignml.com",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supportEmail: "support@sovereignml.com",
  noreplyEmail: "noreply@sovereignml.com",
  github: "https://github.com/sovereignml",
  twitter: "https://twitter.com/sovereignml",
  // Positioning vs ClawHost: they give infra, we give outcomes.
  positioning: {
    headline: "ClawHost gives you infra. SovereignML gives you outcomes.",
    bullets: [
      "We configure your AI",
      "We maintain uptime",
      "We optimize performance",
    ],
  },
} as const

export type Branding = typeof BRANDING
