"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { useState } from "react"
import { PLANS } from "@/configs/plans"
import { SERVER_TYPES, SERVER_CATEGORIES, type ServerCategory } from "@/configs/server-types"

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
}

const featuredServers = [
  { ...SERVER_TYPES[0], displayName: "Starter", popular: false },
  { ...SERVER_TYPES[4], displayName: "Growth", popular: true },
  { ...SERVER_TYPES[2], displayName: "Pro", popular: false },
  { ...SERVER_TYPES[6], displayName: "Business", popular: false },
]

export default function PricingPage() {
  const [activeCategory, setActiveCategory] = useState<ServerCategory>("CX")
  const filtered = SERVER_TYPES.filter((s) => s.category === activeCategory && s.isActive)

  return (
    <div>
      <section className="max-w-[1400px] mx-auto px-8 pb-16">
        <div className="section-header-left max-w-[800px]">
          <motion.h1
            className="text-[3.5rem] md:text-[4rem] font-bold uppercase tracking-[0.02em] leading-[1.1] text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-display)" }}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
          >
            Simple, <span className="text-accent">Transparent</span> Pricing
          </motion.h1>
          <motion.p
            className="text-[var(--text-secondary)] text-lg"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
          >
            Pay for what you use. No hidden fees, no surprises. Cancel anytime.
          </motion.p>
        </div>
      </section>

      {/* Server Cards */}
      <section className="max-w-[1400px] mx-auto px-8 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0">
          {featuredServers.map((server, i) => (
            <motion.div
              key={server.slug}
              className={`relative p-8 transition-all duration-300 ${
                server.popular
                  ? "card-popular-terminal"
                  : "border border-[var(--border-color)] bg-[var(--card-bg)]"
              } hover:bg-[var(--card-hover)]`}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={i + 2}
            >
              {server.popular && <div className="absolute -top-px left-0 right-0 h-[2px] bg-[var(--accent-color)]" />}
              {server.popular && (
                <span className="inline-block px-3 py-1 border border-[var(--accent-color)] text-[var(--accent-color)] text-[0.7rem] uppercase tracking-[0.1em] mb-4" style={{ fontFamily: "var(--font-mono)" }}>
                  Most Popular
                </span>
              )}
              <h3 className="text-2xl font-bold uppercase tracking-[0.02em] text-[var(--text-primary)] mb-1" style={{ fontFamily: "var(--font-display)" }}>
                {server.displayName}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mb-6" style={{ fontFamily: "var(--font-mono)" }}>
                {server.vcpu} vCPU &middot; {server.ramGb} GB RAM &middot; {server.storageGb} GB
              </p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>${server.priceMonthly}</span>
                <span className="text-[var(--text-secondary)] text-sm">/mo</span>
                <span className="text-[var(--text-secondary)] text-xs ml-2" style={{ fontFamily: "var(--font-mono)" }}>(${(server.priceYearly / 12).toFixed(0)}/yr)</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  { label: "OpenClaw Pre-Installed", on: true },
                  { label: "Unlimited Bandwidth", on: true },
                  { label: "Root SSH Access", on: true },
                  { label: "24/7 Online", on: true },
                  { label: "Dedicated CPU", on: server.category !== "CX" },
                  { label: "Email Support", on: true },
                ].map((feat) => (
                  <li key={feat.label} className="flex items-center gap-3 text-sm">
                    {feat.on ? (
                      <span className="text-[var(--accent-color)] font-bold" style={{ fontFamily: "var(--font-mono)" }}>&#10003;</span>
                    ) : (
                      <span className="text-[var(--border-color)] font-bold" style={{ fontFamily: "var(--font-mono)" }}>&times;</span>
                    )}
                    <span className={feat.on ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}>{feat.label}</span>
                  </li>
                ))}
              </ul>
              <Link href="/login?deploy=true" className={`block w-full text-center py-3 text-sm ${server.popular ? "btn-primary" : "btn-secondary"}`}>
                Choose Plan
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Management Plans */}
      <section className="max-w-[1200px] mx-auto px-8 pb-20">
        <div className="section-header-left max-w-[800px]">
          <h2 className="text-[3rem] uppercase tracking-[0.02em] leading-[1.1] text-[var(--text-primary)] mb-2" style={{ fontFamily: "var(--font-display)" }}>
            Management <span className="text-accent">Plans</span>
          </h2>
          <p className="text-[var(--text-secondary)]">Server costs + management plan.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          {PLANS.map((plan) => (
            <div
              key={plan.slug}
              className={`relative p-8 transition-all duration-300 ${
                plan.highlight ? "card-popular-terminal" : "border border-[var(--border-color)] bg-[var(--card-bg)]"
              } hover:bg-[var(--card-hover)]`}
            >
              {plan.highlight && (
                <span className="inline-block px-3 py-1 border border-[var(--accent-color)] text-[var(--accent-color)] text-[0.7rem] uppercase tracking-[0.1em] mb-4" style={{ fontFamily: "var(--font-mono)" }}>
                  Most Popular
                </span>
              )}
              <h2 className="text-2xl font-bold uppercase tracking-[0.02em] text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>{plan.name}</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{plan.description}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>${plan.displayPriceMonthly}</span>
                <span className="text-[var(--text-secondary)]">/mo</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1" style={{ fontFamily: "var(--font-mono)" }}>+ server costs</p>
              <ul className="mt-6 space-y-3 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <span className="text-[var(--accent-color)] font-bold mt-0.5" style={{ fontFamily: "var(--font-mono)" }}>&#10003;</span>
                    <span className="text-[var(--text-primary)]">{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/login?deploy=true" className={`mt-8 block text-center py-3.5 text-sm ${plan.highlight ? "btn-primary" : "btn-secondary"}`}>
                Get Started
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Full Server Table */}
      <section className="max-w-[1000px] mx-auto px-8 pb-24">
        <div className="section-header-left max-w-[800px]">
          <h2 className="text-[3rem] uppercase tracking-[0.02em] leading-[1.1] text-[var(--text-primary)] mb-2" style={{ fontFamily: "var(--font-display)" }}>
            All <span className="text-accent">Servers</span>
          </h2>
          <p className="text-[var(--text-secondary)]">Choose the hardware for your OpenClaw deployment.</p>
        </div>

        <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-6">
          <div className="flex flex-wrap gap-2 mb-6">
            {SERVER_CATEGORIES.map((cat) => (
              <button
                key={cat.category}
                onClick={() => setActiveCategory(cat.category)}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-[0.05em] transition-all duration-200 ${
                  activeCategory === cat.category
                    ? "bg-[var(--accent-color)] text-black border border-[var(--accent-color)]"
                    : "bg-transparent text-[var(--text-secondary)] border border-[var(--border-color)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)]"
                }`}
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {cat.category} — {cat.title}
              </button>
            ))}
          </div>
          <p className="text-[var(--text-secondary)] text-sm mb-6" style={{ fontFamily: "var(--font-mono)" }}>
            &gt; {SERVER_CATEGORIES.find((c) => c.category === activeCategory)?.description}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="text-left text-[var(--text-secondary)] font-bold py-3 px-4 text-xs uppercase tracking-[0.05em]" style={{ fontFamily: "var(--font-mono)" }}>Server</th>
                  <th className="text-center text-[var(--text-secondary)] font-bold py-3 px-4 text-xs uppercase tracking-[0.05em]" style={{ fontFamily: "var(--font-mono)" }}>vCPU</th>
                  <th className="text-center text-[var(--text-secondary)] font-bold py-3 px-4 text-xs uppercase tracking-[0.05em]" style={{ fontFamily: "var(--font-mono)" }}>RAM</th>
                  <th className="text-center text-[var(--text-secondary)] font-bold py-3 px-4 text-xs uppercase tracking-[0.05em]" style={{ fontFamily: "var(--font-mono)" }}>Storage</th>
                  <th className="text-right text-[var(--text-secondary)] font-bold py-3 px-4 text-xs uppercase tracking-[0.05em]" style={{ fontFamily: "var(--font-mono)" }}>Monthly</th>
                  <th className="text-right text-[var(--text-secondary)] font-bold py-3 px-4 text-xs uppercase tracking-[0.05em]" style={{ fontFamily: "var(--font-mono)" }}>Yearly</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.slug} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--card-hover)] transition-colors">
                    <td className="py-3 px-4 text-[var(--text-primary)] font-semibold">{s.label}</td>
                    <td className="py-3 px-4 text-center text-[var(--text-secondary)]">{s.vcpu}</td>
                    <td className="py-3 px-4 text-center text-[var(--text-secondary)]">{s.ramGb} GB</td>
                    <td className="py-3 px-4 text-center text-[var(--text-secondary)]">{s.storageGb} GB</td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-[var(--text-primary)] font-semibold">${s.priceMonthly}</span><span className="text-[var(--text-secondary)]">/mo</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-[var(--accent-color)] font-semibold">${s.priceYearly}</span><span className="text-[var(--text-secondary)]">/yr</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-8 text-[var(--text-secondary)] text-sm" style={{ fontFamily: "var(--font-mono)" }}>
          &gt; All payments handled securely via Stripe. Yearly billing saves ~17% (2 months free).
        </p>
      </section>
    </div>
  )
}
