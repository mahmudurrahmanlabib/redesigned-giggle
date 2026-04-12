"use client"

import { Check, X, ArrowRight } from "lucide-react"
import { BRANDING } from "@/configs/branding"

const comparisonRows = [
  { feature: "One-click AI agent deploy", us: true, vps: false, diy: false },
  { feature: "Agent optimization & tuning", us: true, vps: false, diy: false },
  { feature: "Managed configuration", us: true, vps: false, diy: false },
  { feature: "Multi-agent orchestration", us: true, vps: false, diy: false },
  { feature: "Monitoring & health alerts", us: true, vps: "partial", diy: false },
  { feature: "Full root access", us: true, vps: true, diy: true },
  { feature: "Outcome-focused setup", us: true, vps: false, diy: false },
  { feature: "Dedicated success engineer", us: true, vps: false, diy: false },
  { feature: "SOC2 & audit logs", us: true, vps: false, diy: false },
]

const positioningBlocks = [
  {
    title: "We are not hosting",
    desc: "VPS providers give you a blank server. You still need to install, configure, optimize, and maintain everything yourself. We give you a running AI agent.",
  },
  {
    title: "We are not just infra",
    desc: "Infrastructure is a commodity. What matters is what runs on it. We deliver outcomes — agents that automate real work, not empty compute.",
  },
  {
    title: "We are an AI operations layer",
    desc: "SovereignML sits above infrastructure. We handle deployment, configuration, monitoring, and optimization so you can focus on what your AI agents produce.",
  },
]

function CellIcon({ value }: { value: boolean | string }) {
  if (value === true)
    return <Check className="w-5 h-5 text-[var(--accent-color)] inline-block" />
  if (value === "partial")
    return (
      <span className="font-[var(--font-mono)] text-xs text-[var(--text-secondary)] uppercase">
        Partial
      </span>
    )
  return <X className="w-5 h-5 text-[var(--border-color)] inline-block" />
}

export default function ComparisonPage() {
  return (
    <div>
      {/* Hero */}
      <section className="max-w-[1400px] mx-auto px-8 pb-16">
        <h1
          className="text-[3.5rem] md:text-[4rem] font-bold uppercase tracking-[0.02em] leading-[1.1] text-[var(--text-primary)] max-w-4xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Why SovereignML vs{" "}
          <span className="text-[var(--accent-color)]">Traditional AI Deployment</span>
        </h1>
        <p className="text-[var(--text-secondary)] text-lg mt-4 max-w-2xl">
          Stop managing infrastructure. Start running AI systems.
        </p>
      </section>

      {/* Comparison Table */}
      <section className="max-w-[1000px] mx-auto px-8 pb-20">
        <div className="border border-[var(--border-color)] bg-[var(--card-bg)] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th
                  className="text-left text-[var(--text-secondary)] font-bold py-4 px-5 text-xs uppercase tracking-[0.05em]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Feature
                </th>
                <th
                  className="text-center text-[var(--accent-color)] font-bold py-4 px-5 text-xs uppercase tracking-[0.05em]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  SovereignML
                </th>
                <th
                  className="text-center text-[var(--text-secondary)] font-bold py-4 px-5 text-xs uppercase tracking-[0.05em]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  VPS Providers
                </th>
                <th
                  className="text-center text-[var(--text-secondary)] font-bold py-4 px-5 text-xs uppercase tracking-[0.05em]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  DIY Setup
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr
                  key={row.feature}
                  className="border-b border-[var(--border-color)]/50 hover:bg-[var(--card-hover)] transition-colors"
                >
                  <td className="py-4 px-5 text-[var(--text-primary)] font-semibold">
                    {row.feature}
                  </td>
                  <td className="py-4 px-5 text-center">
                    <CellIcon value={row.us} />
                  </td>
                  <td className="py-4 px-5 text-center">
                    <CellIcon value={row.vps} />
                  </td>
                  <td className="py-4 px-5 text-center">
                    <CellIcon value={row.diy} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Positioning Blocks */}
      <section className="max-w-[1400px] mx-auto px-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {positioningBlocks.map((block) => (
            <div
              key={block.title}
              className="border border-[var(--border-color)] bg-[rgba(10,10,10,0.6)] p-8 transition-all duration-300 hover:border-[var(--accent-color)] hover:-translate-y-1"
            >
              <h3
                className="text-xl font-bold uppercase tracking-wide text-[var(--accent-color)] mb-4"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {block.title}
              </h3>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                {block.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-[1000px] mx-auto px-8 pb-24">
        <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(204,255,0,0.05)_0%,transparent_70%)] pointer-events-none" />
          <div className="relative z-10">
            <h3
              className="text-2xl font-bold uppercase tracking-[0.02em] text-[var(--text-primary)] mb-3"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Ready to See the Difference?
            </h3>
            <p className="text-[var(--text-secondary)] max-w-lg mx-auto mb-6">
              Book a demo and see how SovereignML deploys production AI agents
              in minutes — not weeks.
            </p>
            <a
              href={BRANDING.demoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[var(--accent-color)] text-black font-[var(--font-mono)] font-bold text-sm uppercase tracking-wider px-8 py-4 hover:bg-white transition-colors"
            >
              Book a Demo <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
