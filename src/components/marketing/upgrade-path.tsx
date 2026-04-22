"use client"

import { ArrowRight } from "lucide-react"

const STEPS = [
  {
    label: "Try",
    tier: "Free",
    price: "$0",
    benefit: "100 credits, core workflows, no always-on agents",
  },
  {
    label: "Build",
    tier: "Builder",
    price: "$79/mo",
    benefit: "Deploy agents, automation, 1 live agent",
  },
  {
    label: "Operate",
    tier: "Operator",
    price: "$199/mo",
    benefit: "Multi-agent workflows, priority processing",
  },
  {
    label: "Scale",
    tier: "Enterprise",
    price: "From $1,000/mo",
    benefit: "Dedicated infrastructure, SLA, custom credits",
  },
]

export function UpgradePath() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-0 relative">
      {STEPS.map((step, i) => (
        <div
          key={step.label}
          className="relative border border-[var(--border-color)] p-8 text-center group hover:border-[var(--accent-color)] transition-all duration-300"
        >
          <div className="font-[var(--font-mono)] text-4xl font-bold text-[rgba(255,255,255,0.05)] absolute top-4 right-4">
            0{i + 1}
          </div>

          <div className="font-[var(--font-mono)] text-[var(--accent-color)] text-sm uppercase tracking-widest mb-3">
            {step.label}
          </div>

          <h4 className="font-[var(--font-display)] text-2xl font-bold uppercase text-[var(--text-primary)] mb-1">
            {step.tier}
          </h4>

          <div className="font-[var(--font-mono)] text-lg text-[var(--text-primary)] mb-3">
            {step.price}
          </div>

          <p className="text-[var(--text-secondary)] text-sm">
            {step.benefit}
          </p>

          {i < STEPS.length - 1 && (
            <ArrowRight className="hidden xl:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 text-[var(--accent-color)]" />
          )}
        </div>
      ))}
    </div>
  )
}
