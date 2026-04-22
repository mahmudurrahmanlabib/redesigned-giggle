import Link from "next/link"
import { Check, X } from "lucide-react"
import type { PlanConfig } from "@/configs/plans"
import { formatUsd } from "@/configs/plans"
import { BRANDING } from "@/configs/branding"
import type { BillingInterval } from "./billing-interval-toggle"

type Props = {
  plan: PlanConfig
  interval: BillingInterval
}

function PriceBlock({ plan, interval }: Props) {
  if (plan.tier === "enterprise" && plan.enterprisePriceLabel) {
    return (
      <div className="mt-6">
        <span
          className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] leading-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {plan.enterprisePriceLabel}
        </span>
      </div>
    )
  }

  if (plan.tier === "free") {
    return (
      <div className="mt-6 flex items-baseline gap-1">
        <span
          className="text-4xl font-bold text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {formatUsd(0)}
        </span>
        <span className="text-[var(--text-secondary)] text-sm">/mo</span>
      </div>
    )
  }

  const isYear = interval === "year"
  const amount = isYear ? plan.displayPriceYearly : plan.displayPriceMonthly
  const suffix = isYear ? "/year" : "/mo"

  return (
    <div className="mt-6">
      <div className="flex items-baseline gap-1 flex-wrap">
        <span
          className="text-4xl font-bold text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {formatUsd(amount)}
        </span>
        <span className="text-[var(--text-secondary)]">{suffix}</span>
      </div>
      {isYear && (
        <p className="mt-1 text-xs font-[var(--font-mono)] text-[var(--accent-color)] uppercase tracking-wide">
          2 months free
        </p>
      )}
    </div>
  )
}

function Cta({ plan }: { plan: PlanConfig }) {
  const base =
    "mt-8 block text-center py-3.5 text-sm font-[var(--font-mono)] font-bold uppercase tracking-wider transition-all"

  if (plan.cta === "contact-sales") {
    return (
      <a
        href={BRANDING.demoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${base} border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)]`}
      >
        Contact Sales
      </a>
    )
  }

  if (plan.cta === "start-free") {
    return (
      <Link
        href="/login?deploy=true"
        className={`${base} border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)]`}
      >
        Start Free
      </Link>
    )
  }

  return (
    <Link
      href="/login?deploy=true"
      className={`${base} ${
        plan.highlight
          ? "bg-[var(--accent-color)] text-black hover:bg-white"
          : "border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)]"
      }`}
    >
      Get Started
    </Link>
  )
}

export function PricingTierCard(props: Props) {
  const { plan } = props

  return (
    <div
      className={`relative flex flex-col h-full p-6 sm:p-8 border transition-colors duration-200 ${
        plan.highlight
          ? "border-[var(--accent-color)] bg-[rgba(204,255,0,0.03)]"
          : "border-[var(--border-color)] bg-[var(--card-bg)]"
      } hover:bg-[var(--card-hover)]`}
    >
      {plan.highlight && (
        <div className="absolute -top-3 left-6 bg-[var(--accent-color)] text-black font-[var(--font-mono)] text-xs font-bold uppercase tracking-widest px-3 py-1">
          Most Popular
        </div>
      )}

      <h2
        className="text-xl sm:text-2xl font-bold uppercase tracking-[0.02em] text-[var(--text-primary)]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {plan.name}
      </h2>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">{plan.description}</p>

      <PriceBlock {...props} />

      <ul className="mt-6 space-y-2.5 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm">
            <Check className="w-4 h-4 text-[var(--accent-color)] shrink-0 mt-0.5" aria-hidden />
            <span className="text-[var(--text-primary)] leading-snug">{f}</span>
          </li>
        ))}
        {plan.restrictions?.map((r) => (
          <li key={r} className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)]">
            <X className="w-4 h-4 shrink-0 mt-0.5 opacity-60" aria-hidden />
            <span className="leading-snug">{r}</span>
          </li>
        ))}
      </ul>

      <Cta plan={plan} />
    </div>
  )
}
