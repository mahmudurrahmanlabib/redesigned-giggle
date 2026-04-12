"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { PLANS } from "@/configs/plans"
import { AGENT_CATEGORIES } from "@/configs/agent-categories"
import { BRANDING } from "@/configs/branding"
import { Check, ArrowRight } from "lucide-react"

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
}

const agentAccess: Record<string, Record<string, boolean>> = {
  starter: { automation: true, devops: false, support: true, research: false, content: false, sales: false, social: false, custom: false },
  pro: { automation: true, devops: true, support: true, research: true, content: true, sales: true, social: true, custom: false },
  enterprise: { automation: true, devops: true, support: true, research: true, content: true, sales: true, social: true, custom: true },
}

export default function PricingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="max-w-[1400px] mx-auto px-8 pb-16">
        <div className="max-w-[800px]">
          <motion.h1
            className="text-[3.5rem] md:text-[4rem] font-bold uppercase tracking-[0.02em] leading-[1.1] text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-display)" }}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
          >
            Simple, <span className="text-[var(--accent-color)]">Transparent</span> Pricing
          </motion.h1>
          <motion.p
            className="text-[var(--text-secondary)] text-lg"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
          >
            Start small, scale as you grow. No hidden fees, cancel anytime.
          </motion.p>
        </div>
      </section>

      {/* Plan Cards */}
      <section className="max-w-[1200px] mx-auto px-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.slug}
              className={`relative p-8 transition-all duration-300 ${
                plan.highlight
                  ? "border border-[var(--accent-color)] bg-[rgba(204,255,0,0.03)]"
                  : "border border-[var(--border-color)] bg-[var(--card-bg)]"
              } hover:bg-[var(--card-hover)]`}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={i + 2}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-6 bg-[var(--accent-color)] text-black font-[var(--font-mono)] text-xs font-bold uppercase tracking-widest px-3 py-1">
                  Most Popular
                </div>
              )}

              <h2
                className="text-2xl font-bold uppercase tracking-[0.02em] text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {plan.name}
              </h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{plan.description}</p>

              <div className="mt-6 flex items-baseline gap-1">
                <span
                  className="text-4xl font-bold text-[var(--text-primary)]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  ${plan.displayPriceMonthly}
                </span>
                <span className="text-[var(--text-secondary)]">/mo</span>
              </div>

              <ul className="mt-6 space-y-3 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <Check className="w-4 h-4 text-[var(--accent-color)] shrink-0 mt-0.5" />
                    <span className="text-[var(--text-primary)]">{f}</span>
                  </li>
                ))}
              </ul>

              {plan.tier === "enterprise" ? (
                <a
                  href={BRANDING.demoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 block text-center py-3.5 text-sm border border-[var(--border-color)] text-[var(--text-primary)] font-[var(--font-mono)] font-bold uppercase tracking-wider hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-all"
                >
                  Book a Demo
                </a>
              ) : (
                <Link
                  href="/login?deploy=true"
                  className={`mt-8 block text-center py-3.5 text-sm font-[var(--font-mono)] font-bold uppercase tracking-wider transition-all ${
                    plan.highlight
                      ? "bg-[var(--accent-color)] text-black hover:bg-white"
                      : "border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)]"
                  }`}
                >
                  Get Started
                </Link>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Agent Access Comparison */}
      <section className="max-w-[1000px] mx-auto px-8 pb-20">
        <div className="max-w-[800px] mb-8">
          <h2
            className="text-[2.5rem] uppercase tracking-[0.02em] leading-[1.1] text-[var(--text-primary)] mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Agent Types <span className="text-[var(--accent-color)]">by Plan</span>
          </h2>
          <p className="text-[var(--text-secondary)]">
            See which agent types are available at each tier.
          </p>
        </div>

        <div className="border border-[var(--border-color)] bg-[var(--card-bg)] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th
                  className="text-left text-[var(--text-secondary)] font-bold py-3 px-4 text-xs uppercase tracking-[0.05em]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Agent Type
                </th>
                {PLANS.map((p) => (
                  <th
                    key={p.slug}
                    className="text-center text-[var(--text-secondary)] font-bold py-3 px-4 text-xs uppercase tracking-[0.05em]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AGENT_CATEGORIES.map((cat) => (
                <tr
                  key={cat.slug}
                  className="border-b border-[var(--border-color)]/50 hover:bg-[var(--card-hover)] transition-colors"
                >
                  <td className="py-3 px-4 text-[var(--text-primary)] font-semibold">
                    {cat.name}
                  </td>
                  {PLANS.map((p) => (
                    <td key={p.slug} className="py-3 px-4 text-center">
                      {agentAccess[p.slug]?.[cat.slug] ? (
                        <Check className="w-4 h-4 text-[var(--accent-color)] inline-block" />
                      ) : (
                        <span className="text-[var(--border-color)]">&mdash;</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Enterprise CTA */}
      <section className="max-w-[1000px] mx-auto px-8 pb-24">
        <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(204,255,0,0.05)_0%,transparent_70%)] pointer-events-none" />
          <div className="relative z-10">
            <h3
              className="text-2xl font-bold uppercase tracking-[0.02em] text-[var(--text-primary)] mb-3"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Need a Custom AI System?
            </h3>
            <p className="text-[var(--text-secondary)] max-w-lg mx-auto mb-6">
              Our team will design, build, and deploy a multi-agent system tailored to your business.
            </p>
            <a
              href={BRANDING.demoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[var(--accent-color)] text-black font-[var(--font-mono)] font-bold text-sm uppercase tracking-wider px-8 py-4 hover:bg-white transition-colors"
            >
              Book a Strategy Call <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        <p
          className="mt-8 text-[var(--text-secondary)] text-sm"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          &gt; All payments handled securely via Stripe. Cancel anytime.
        </p>
      </section>
    </div>
  )
}
