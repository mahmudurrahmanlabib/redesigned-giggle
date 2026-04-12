"use client"

import { ArrowRight } from "lucide-react"

const STEPS = [
  {
    label: "Start",
    tier: "Starter",
    price: "$5/mo",
    benefit: "Launch your first AI agent",
  },
  {
    label: "Grow",
    tier: "Pro",
    price: "$29/mo",
    benefit: "Scale to 10 agents across all types",
  },
  {
    label: "Scale",
    tier: "Enterprise",
    price: "$199/mo",
    benefit: "Unlimited agents, custom builds, dedicated support",
  },
]

export function UpgradePath() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-0 relative">
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
            <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 text-[var(--accent-color)]" />
          )}
        </div>
      ))}
    </div>
  )
}
