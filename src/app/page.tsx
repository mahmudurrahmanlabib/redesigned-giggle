"use client"

import Link from "next/link"
import { motion, type Variants } from "framer-motion"
import Navbar from "@/components/layout/navbar"
import Footer from "@/components/layout/footer"
import { SERVER_TYPES, SERVER_CATEGORIES, type ServerCategory } from "@/configs/server-types"
import { REGIONS } from "@/configs/regions"
import { PLANS } from "@/configs/plans"
import { useState } from "react"

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

const featuredServers = [
  { ...SERVER_TYPES[0], displayName: "Starter", popular: false },
  { ...SERVER_TYPES[4], displayName: "Growth", popular: true },
  { ...SERVER_TYPES[2], displayName: "Pro", popular: false },
  { ...SERVER_TYPES[6], displayName: "Business", popular: false },
]

const features = [
  { title: "One-Click Deploy", desc: "OpenClaw pre-installed and ready within minutes on your own dedicated server. Zero config.", marker: "DEPLOY" },
  { title: "100% Owned Data", desc: "Your server, your data. No shared infrastructure, no third-party logs. Online 24/7.", marker: "PRIVACY" },
  { title: "Full Speed", desc: "Dedicated VPS resources. No throttling, full bandwidth, lightning-fast inference.", marker: "PERF" },
  { title: "Global Locations", desc: "Deploy across multiple regions. Choose the location closest to your users.", marker: "GEO" },
  { title: "Direct SSH Access", desc: "Full root access to your server terminal. No restrictions, total control.", marker: "ACCESS" },
  { title: "Managed Config", desc: "We configure your AI agents for peak performance. Not just infra — outcomes.", marker: "OPS" },
  { title: "Health Monitoring", desc: "Real-time health metrics, uptime tracking, and proactive alerts.", marker: "HEALTH" },
  { title: "Version Control", desc: "Switch to any OpenClaw version with a single click. Rollback when needed.", marker: "VERSION" },
  { title: "Multiple Agents", desc: "Run multiple AI agents on a single instance. Each with its own config.", marker: "MULTI" },
]

const comparisonRows = [
  { feature: "Deploy OpenClaw", us: true, them: true },
  { feature: "Configure & optimize agents", us: true, them: false },
  { feature: "Managed uptime & maintenance", us: true, them: false },
  { feature: "Agent health monitoring", us: true, them: false },
  { feature: "Full SSH / root access", us: true, them: true },
  { feature: "Global multi-region", us: true, them: true },
  { feature: "Onboarding flow", us: true, them: false },
  { feature: "Performance optimization", us: true, them: false },
  { feature: "Dedicated success engineer", us: true, them: false },
]

const faq = [
  { q: "What is SovereignML?", a: "SovereignML is the AI operations layer. We deploy OpenClaw on dedicated infrastructure, then configure, maintain, and optimize it so you can focus on building agents — not managing servers." },
  { q: "How is this different from ClawHost?", a: "ClawHost gives you infrastructure. SovereignML gives you outcomes. We don't just deploy — we configure your agents, maintain uptime, monitor health, and optimize performance." },
  { q: "Do I need technical knowledge?", a: "No. Our one-click deployment and managed configuration means you can get started without DevOps experience. Power users get full SSH and root access." },
  { q: "What locations are available?", a: `We offer ${REGIONS.filter(r => r.available).length} regions across the US, Europe, and Asia-Pacific. More locations are added regularly.` },
  { q: "Can I cancel anytime?", a: "Yes. All plans are billed monthly or yearly with no lock-in. Cancel anytime from your dashboard." },
]

function ServerPricingCards() {
  return (
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
          whileInView="visible"
          viewport={{ once: true }}
          custom={i}
        >
          {server.popular && (
            <div
              className="absolute -top-px left-0 right-0 h-[2px] bg-[var(--accent-color)]"
            />
          )}
          {server.popular && (
            <span
              className="inline-block px-3 py-1 border border-[var(--accent-color)] text-[var(--accent-color)] text-[0.7rem] uppercase tracking-[0.1em] mb-4"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Most Popular
            </span>
          )}

          <h3
            className="text-2xl font-bold uppercase tracking-[0.02em] text-[var(--text-primary)] mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {server.displayName}
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mb-6" style={{ fontFamily: "var(--font-mono)" }}>
            {server.vcpu} vCPU &middot; {server.ramGb} GB RAM &middot; {server.storageGb} GB
          </p>

          <div className="mb-6">
            <span className="text-4xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
              ${server.priceMonthly}
            </span>
            <span className="text-[var(--text-secondary)] text-sm">/mo</span>
            <span className="text-[var(--text-secondary)] text-xs ml-2" style={{ fontFamily: "var(--font-mono)" }}>
              (${(server.priceYearly / 12).toFixed(0)}/yr)
            </span>
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
                <span className={feat.on ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}>
                  {feat.label}
                </span>
              </li>
            ))}
          </ul>

          <Link
            href="/login?deploy=true"
            className={`block w-full text-center py-3 text-sm transition-all duration-200 ${
              server.popular
                ? "btn-primary"
                : "btn-secondary"
            }`}
          >
            Choose Plan
          </Link>
        </motion.div>
      ))}
    </div>
  )
}

function AllServersTable() {
  const [activeCategory, setActiveCategory] = useState<ServerCategory>("CX")
  const filtered = SERVER_TYPES.filter((s) => s.category === activeCategory && s.isActive)

  return (
    <div className="mt-8">
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
      <div className="overflow-x-auto border border-[var(--border-color)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
              <th className="text-left text-[var(--text-secondary)] font-bold py-3 px-5 text-xs uppercase tracking-[0.05em]" style={{ fontFamily: "var(--font-mono)" }}>Server</th>
              <th className="text-center text-[var(--text-secondary)] font-bold py-3 px-5 text-xs uppercase tracking-[0.05em]" style={{ fontFamily: "var(--font-mono)" }}>vCPU</th>
              <th className="text-center text-[var(--text-secondary)] font-bold py-3 px-5 text-xs uppercase tracking-[0.05em]" style={{ fontFamily: "var(--font-mono)" }}>RAM</th>
              <th className="text-center text-[var(--text-secondary)] font-bold py-3 px-5 text-xs uppercase tracking-[0.05em]" style={{ fontFamily: "var(--font-mono)" }}>Storage</th>
              <th className="text-right text-[var(--text-secondary)] font-bold py-3 px-5 text-xs uppercase tracking-[0.05em]" style={{ fontFamily: "var(--font-mono)" }}>Monthly</th>
              <th className="text-right text-[var(--text-secondary)] font-bold py-3 px-5 text-xs uppercase tracking-[0.05em]" style={{ fontFamily: "var(--font-mono)" }}>Yearly</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.slug} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--card-hover)] transition-colors">
                <td className="py-3 px-5 text-[var(--text-primary)] font-semibold">{s.label}</td>
                <td className="py-3 px-5 text-center text-[var(--text-secondary)]">{s.vcpu}</td>
                <td className="py-3 px-5 text-center text-[var(--text-secondary)]">{s.ramGb} GB</td>
                <td className="py-3 px-5 text-center text-[var(--text-secondary)]">{s.storageGb} GB</td>
                <td className="py-3 px-5 text-right">
                  <span className="text-[var(--text-primary)] font-semibold">${s.priceMonthly}</span>
                  <span className="text-[var(--text-secondary)]">/mo</span>
                </td>
                <td className="py-3 px-5 text-right">
                  <span className="text-[var(--accent-color)] font-semibold">${s.priceYearly}</span>
                  <span className="text-[var(--text-secondary)]">/yr</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)

  return (
    <>
      <Navbar />
      <main className="min-h-screen overflow-hidden">
        {/* ───── HERO ───── */}
        <section className="relative pt-[calc(80px+8rem)] pb-32 min-h-screen flex items-center">
          <div className="absolute inset-0 z-[1] pointer-events-none"
            style={{
              background: "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.02) 2px, rgba(255,255,255,0.02) 3px)"
            }}
          />

          <div className="max-w-[1400px] mx-auto px-8 w-full relative z-[2]">
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-16 items-center">
              <div className="relative">
                <motion.p
                  className="text-[var(--accent-color)] text-[0.9rem] mb-6 opacity-80"
                  style={{ fontFamily: "var(--font-mono)" }}
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  custom={0}
                >
                  [ SYSTEM_ONLINE ]
                </motion.p>

                <motion.h1
                  className="text-[3.5rem] sm:text-[4rem] md:text-[5rem] font-bold uppercase tracking-[0.02em] leading-[1.1] mb-6"
                  style={{ fontFamily: "var(--font-display)" }}
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  custom={1}
                >
                  <span className="text-[var(--text-primary)]">Deploy </span>
                  <span className="text-accent">OpenClaw.</span>
                  <br />
                  <span className="text-[var(--text-primary)]">One Click. Done.</span>
                </motion.h1>

                <motion.p
                  className="text-[1.25rem] text-[var(--text-secondary)] max-w-[600px] mb-12 border-l-2 border-[var(--accent-color)] pl-6 leading-relaxed"
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  custom={2}
                >
                  Deploy OpenClaw agents in the cloud with one click — then let us configure,
                  maintain, and optimize them. Full root access, global locations, ready in minutes.
                </motion.p>

                <motion.div
                  className="flex flex-wrap gap-6"
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  custom={3}
                >
                  <Link href="/login?deploy=true" className="btn-primary px-10 py-4 text-base">
                    Deploy Now
                  </Link>
                  <Link href="#pricing" className="btn-secondary px-10 py-4 text-base">
                    View Pricing
                  </Link>
                </motion.div>
              </div>

              <motion.div
                className="hidden lg:flex relative h-[500px] border border-[var(--border-color)] items-center justify-center clip-corners-lg"
                style={{
                  background: "linear-gradient(rgba(204,255,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(204,255,0,0.05) 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={2}
              >
                <div className="absolute inset-0" style={{ background: "radial-gradient(circle at center, transparent 30%, #030303 100%)" }} />
                <div
                  className="absolute inset-0 pointer-events-none z-10"
                  style={{
                    background: "linear-gradient(to bottom, transparent, rgba(204,255,0,0.15), transparent)",
                    animation: "scanline 3s linear infinite",
                    height: "20%",
                  }}
                />
                <div className="relative z-[5] text-center px-8">
                  <div
                    className="text-[var(--accent-color)] text-sm mb-4 opacity-60"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    $ sovereignml deploy --openclaw
                  </div>
                  <div className="text-[var(--text-primary)] text-lg" style={{ fontFamily: "var(--font-mono)" }}>
                    <span className="text-[var(--accent-color)]">&gt;</span> Provisioning server...
                    <br />
                    <span className="text-[var(--accent-color)]">&gt;</span> Installing OpenClaw v4.2...
                    <br />
                    <span className="text-[var(--accent-color)]">&gt;</span> Configuring agents...
                    <br />
                    <span className="text-[var(--accent-color)]">&gt;</span> <span className="text-accent">READY</span>
                    <span className="inline-block w-[10px] h-[20px] bg-[var(--accent-color)] ml-1 animate-pulse" />
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ───── TRUSTED / STATS ───── */}
        <section className="border-y border-[var(--border-color)] bg-[var(--bg-secondary)] py-8">
          <div className="max-w-[1400px] mx-auto px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { value: `$${SERVER_TYPES[0]?.priceMonthly ?? 5}/mo`, label: "Starting At" },
                { value: `${REGIONS.filter(r => r.available).length}+`, label: "Global Regions" },
                { value: `${SERVER_TYPES.length}+`, label: "Server Configs" },
                { value: "Zero", label: "Config Required" },
              ].map((stat) => (
                <div key={stat.label} className="text-center py-4">
                  <div
                    className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-1"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {stat.value}
                  </div>
                  <div
                    className="text-[0.75rem] text-[var(--text-secondary)] uppercase tracking-[0.1em]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ───── FEATURES ───── */}
        <section id="features" className="py-24">
          <div className="max-w-[1400px] mx-auto px-8">
            <motion.div
              className="section-header-left max-w-[800px]"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={0}
            >
              <h2
                className="text-[3.5rem] uppercase tracking-[0.02em] leading-[1.1] text-[var(--text-primary)] mb-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Built for <span className="text-accent">Operators</span>
              </h2>
              <p className="text-[var(--text-secondary)]">
                Everything you need to deploy, manage, and scale agentic AI.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  className="card-terminal p-8 min-h-[280px] flex flex-col justify-end"
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  custom={i % 6}
                >
                  <span
                    className="absolute top-4 right-4 text-[var(--text-secondary)] text-[0.7rem] opacity-50"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    [ {f.marker} ]
                  </span>
                  <div className="relative z-[2]">
                    <div className="w-[50px] h-[50px] mb-6 text-[var(--accent-color)] opacity-80">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-full h-full">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3
                      className="text-[1.8rem] font-bold uppercase tracking-[0.02em] text-[var(--text-primary)] mb-3 leading-[1.1]"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {f.title}
                    </h3>
                    <p className="text-[var(--text-secondary)] text-[1rem] leading-relaxed">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ───── HOW IT WORKS ───── */}
        <section className="py-24 border-t border-[var(--border-color)]">
          <div className="max-w-[1400px] mx-auto px-8">
            <div className="section-header-left max-w-[800px]">
              <h2
                className="text-[3.5rem] uppercase tracking-[0.02em] leading-[1.1] text-[var(--text-primary)] mb-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                How It <span className="text-accent">Works</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
              {[
                { n: "01", title: "Choose Your Server", desc: "Pick the instance size and region that fits your workload — from lightweight CX to dedicated CCX." },
                { n: "02", title: "Configure & Pay", desc: "Set your billing cycle, add SSH keys and storage, then pay securely via Stripe." },
                { n: "03", title: "Deploy & Operate", desc: "Your OpenClaw instance is provisioned in minutes. We handle config, maintenance, and monitoring." },
              ].map((step, i) => (
                <motion.div
                  key={step.n}
                  className="relative p-8 border-l border-[var(--border-color)] group hover:border-l-[var(--accent-color)] transition-colors min-h-[250px]"
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  custom={i}
                >
                  <span
                    className="absolute top-4 right-4 text-[4rem] font-bold leading-none text-white/[0.05]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {step.n}
                  </span>
                  <h3
                    className="text-[1.5rem] font-bold uppercase tracking-[0.02em] text-[var(--text-primary)] mb-4"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {step.title}
                  </h3>
                  <p className="text-[var(--text-secondary)] leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ───── PRICING ───── */}
        <section id="pricing" className="py-24">
          <div className="max-w-[1400px] mx-auto px-8">
            <motion.div
              className="section-header-left max-w-[800px]"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={0}
            >
              <h2
                className="text-[3.5rem] uppercase tracking-[0.02em] leading-[1.1] text-[var(--text-primary)] mb-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Simple, <span className="text-accent">Transparent</span> Pricing
              </h2>
              <p className="text-[var(--text-secondary)]">
                Choose a plan that fits your needs. No hidden fees.
              </p>
            </motion.div>

            <ServerPricingCards />

            <div className="mt-10 text-center">
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-[var(--text-secondary)] hover:text-[var(--accent-color)] text-sm uppercase tracking-[0.05em] transition-colors inline-flex items-center gap-2"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {showAll ? "Hide" : "Show"} All Plans
                <svg
                  className={`w-4 h-4 transition-transform duration-300 ${showAll ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {showAll && <AllServersTable />}
          </div>
        </section>

        {/* ───── MANAGEMENT PLANS ───── */}
        <section className="py-24 bg-[var(--bg-secondary)] border-y border-[var(--border-color)]">
          <div className="max-w-[1200px] mx-auto px-8">
            <div className="section-header-left max-w-[800px]">
              <h2
                className="text-[3.5rem] uppercase tracking-[0.02em] leading-[1.1] text-[var(--text-primary)] mb-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Management <span className="text-accent">Plans</span>
              </h2>
              <p className="text-[var(--text-secondary)]">
                Server costs + management plan. Upgrade for more instances and managed services.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
              {PLANS.map((plan, i) => (
                <motion.div
                  key={plan.slug}
                  className={`relative p-8 transition-all duration-300 ${
                    plan.highlight
                      ? "card-popular-terminal"
                      : "border border-[var(--border-color)] bg-[var(--card-bg)]"
                  } hover:bg-[var(--card-hover)]`}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  custom={i}
                >
                  {plan.highlight && (
                    <span
                      className="inline-block px-3 py-1 border border-[var(--accent-color)] text-[var(--accent-color)] text-[0.7rem] uppercase tracking-[0.1em] mb-4"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      Most Popular
                    </span>
                  )}
                  <h3
                    className="text-2xl font-bold uppercase tracking-[0.02em] text-[var(--text-primary)]"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {plan.name}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-2">{plan.description}</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
                      ${plan.displayPriceMonthly}
                    </span>
                    <span className="text-[var(--text-secondary)]">/mo</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1" style={{ fontFamily: "var(--font-mono)" }}>
                    + server costs
                  </p>
                  <ul className="mt-6 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm">
                        <span className="text-[var(--accent-color)] font-bold mt-0.5" style={{ fontFamily: "var(--font-mono)" }}>&#10003;</span>
                        <span className="text-[var(--text-primary)]">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/login?deploy=true"
                    className={`mt-8 block w-full text-center py-3 text-sm ${
                      plan.highlight ? "btn-primary" : "btn-secondary"
                    }`}
                  >
                    Get Started
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ───── COMPARISON ───── */}
        <section className="py-24">
          <div className="max-w-[900px] mx-auto px-8">
            <div className="section-header-left max-w-[800px]">
              <h2
                className="text-[3.5rem] uppercase tracking-[0.02em] leading-[1.1] text-[var(--text-primary)] mb-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                How We&apos;re <span className="text-accent">Different</span>
              </h2>
              <p className="text-[var(--text-secondary)]">
                ClawHost gives you infra. SovereignML gives you outcomes.
              </p>
            </div>

            <div className="border border-[var(--border-color)] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                    <th className="text-left text-[var(--text-secondary)] font-bold py-4 px-6 text-xs uppercase tracking-[0.05em]" style={{ fontFamily: "var(--font-mono)" }}>Feature</th>
                    <th className="text-center py-4 px-4 text-xs uppercase tracking-[0.05em] font-bold text-[var(--accent-color)]" style={{ fontFamily: "var(--font-mono)" }}>SovereignML</th>
                    <th className="text-center text-[var(--text-secondary)] font-bold py-4 px-4 text-xs uppercase tracking-[0.05em]" style={{ fontFamily: "var(--font-mono)" }}>Others</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.feature} className="border-b border-[var(--border-color)]/50">
                      <td className="py-3 px-6 text-[var(--text-primary)]">{row.feature}</td>
                      <td className="py-3 px-4 text-center">
                        {row.us ? (
                          <span className="text-[var(--accent-color)] font-bold" style={{ fontFamily: "var(--font-mono)" }}>&#10003;</span>
                        ) : (
                          <span className="text-[var(--border-color)]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {row.them ? (
                          <span className="text-[var(--text-secondary)]">&#10003;</span>
                        ) : (
                          <span className="text-red-500/70">&#10007;</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ───── FAQ ───── */}
        <section className="py-24 border-t border-[var(--border-color)]">
          <div className="max-w-[900px] mx-auto px-8">
            <div className="section-header-left max-w-[800px]">
              <h2
                className="text-[3rem] uppercase tracking-[0.02em] leading-[1.1] text-[var(--text-primary)] mb-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Questions
              </h2>
            </div>
            <div className="space-y-0">
              {faq.map((item, i) => (
                <div key={i} className="border border-[var(--border-color)] border-t-0 first:border-t">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full text-left px-6 py-5 flex items-center justify-between hover:bg-[var(--card-hover)] transition-colors"
                  >
                    <span className="text-[var(--text-primary)] font-semibold text-sm">{item.q}</span>
                    <span
                      className={`text-[var(--accent-color)] text-sm transition-transform duration-200 ${openFaq === i ? "rotate-45" : ""}`}
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      +
                    </span>
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-5 border-t border-[var(--border-color)]/50">
                      <p className="text-[var(--text-secondary)] text-sm leading-relaxed pt-4">{item.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ───── FINAL CTA ───── */}
        <section className="relative py-32 text-center overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(204,255,0,0.05) 0%, transparent 70%)"
            }}
          />
          <div className="max-w-[800px] mx-auto px-8 relative z-[2]">
            <motion.h2
              className="text-[3rem] md:text-[4rem] font-bold uppercase tracking-[0.02em] leading-[1.1] text-[var(--text-primary)] mb-6"
              style={{ fontFamily: "var(--font-display)" }}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={0}
            >
              Ready to <span className="text-accent">Deploy</span>?
            </motion.h2>

            <motion.p
              className="text-[var(--text-secondary)] text-lg mb-12 max-w-[600px] mx-auto"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={1}
            >
              Dedicated server. OpenClaw pre-installed. Full root access.
              Global locations. Ready in minutes. Starting from ${SERVER_TYPES[0]?.priceMonthly ?? 5}/mo.
            </motion.p>

            <motion.div
              className="flex flex-wrap gap-6 justify-center"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={2}
            >
              <Link href="/login?deploy=true" className="btn-primary px-10 py-4 text-base">
                Deploy Now
              </Link>
              <Link href="/community" className="btn-secondary px-10 py-4 text-base">
                Join Community
              </Link>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
