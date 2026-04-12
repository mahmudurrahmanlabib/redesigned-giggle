"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Zap,
  Terminal,
  MessageSquare,
  Search,
  PenTool,
  TrendingUp,
  Share2,
  Settings,
  ArrowRight,
  ArrowLeft,
} from "lucide-react"
import Link from "next/link"
import { AGENT_CATEGORIES } from "@/configs/agent-categories"
import { BRANDING } from "@/configs/branding"

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap, Terminal, MessageSquare, Search, PenTool, TrendingUp, Share2, Settings,
}

const USE_CASES = [
  { label: "Automate customer support", agentSlug: "support" },
  { label: "Monitor my infrastructure", agentSlug: "devops" },
  { label: "Generate content at scale", agentSlug: "content" },
  { label: "Automate lead generation", agentSlug: "sales" },
  { label: "Research & analyze data", agentSlug: "research" },
  { label: "Automate business workflows", agentSlug: "automation" },
  { label: "Manage social media & grow audience", agentSlug: "social" },
  { label: "Build something custom", agentSlug: "custom" },
]

export function SmartPlanner() {
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)

  const selectedAgent = AGENT_CATEGORIES.find((a) => a.slug === selected)
  const SelectedIcon = selectedAgent ? ICON_MAP[selectedAgent.icon] ?? Zap : Zap

  return (
    <div className="border border-[var(--border-color)] bg-[rgba(10,10,10,0.6)] p-8 md:p-12 relative overflow-hidden">
      <div className="absolute top-4 right-4 font-[var(--font-mono)] text-[0.7rem] text-[var(--text-secondary)] opacity-40">
        STEP {step + 1}/3
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="step0"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <h3 className="font-[var(--font-display)] text-2xl md:text-3xl font-bold uppercase tracking-wide text-[var(--text-primary)] mb-2">
              What do you want to build?
            </h3>
            <p className="text-[var(--text-secondary)] mb-8">
              Select a use case and we'll recommend the right agent for you.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {USE_CASES.map((uc) => (
                <button
                  key={uc.agentSlug}
                  onClick={() => {
                    setSelected(uc.agentSlug)
                    setStep(1)
                  }}
                  className="text-left p-4 border border-[var(--border-color)] bg-transparent hover:border-[var(--accent-color)] hover:bg-[rgba(204,255,0,0.05)] transition-all duration-200 group cursor-pointer"
                >
                  <span className="font-[var(--font-mono)] text-sm text-[var(--text-primary)] group-hover:text-[var(--accent-color)] transition-colors">
                    {uc.label}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 1 && selectedAgent && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <button
              onClick={() => setStep(0)}
              className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--accent-color)] font-[var(--font-mono)] text-sm mb-6 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="flex items-start gap-4 mb-6">
              <SelectedIcon className="w-10 h-10 text-[var(--accent-color)] shrink-0 mt-1" />
              <div>
                <h3 className="font-[var(--font-display)] text-2xl font-bold uppercase tracking-wide text-[var(--text-primary)] mb-1">
                  We recommend: {selectedAgent.name}
                </h3>
                <p className="text-[var(--text-secondary)]">
                  {selectedAgent.description}
                </p>
              </div>
            </div>

            <div className="border border-[var(--border-color)] bg-[#050505] p-5 mb-6 font-[var(--font-mono)] text-sm">
              <div className="text-[var(--text-secondary)] mb-2">
                Suggested configuration:
              </div>
              <div className="text-[var(--accent-color)]">
                agent_type: {selectedAgent.slug}
              </div>
              <div className="text-[var(--text-primary)]">
                compute: auto-scaled
              </div>
              <div className="text-[var(--text-primary)]">
                monitoring: enabled
              </div>
              <div className="text-[var(--text-primary)]">
                privacy: strict
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-2 bg-[var(--accent-color)] text-black font-[var(--font-mono)] font-bold text-sm uppercase tracking-wider px-6 py-3 hover:bg-white transition-colors cursor-pointer"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="text-center"
          >
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--accent-color)] font-[var(--font-mono)] text-sm mb-6 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <h3 className="font-[var(--font-display)] text-2xl md:text-3xl font-bold uppercase tracking-wide text-[var(--text-primary)] mb-3">
              Ready to launch your agent
            </h3>
            <p className="text-[var(--text-secondary)] mb-8 max-w-lg mx-auto">
              Deploy now for instant setup, or talk to our team for a custom
              configuration tailored to your business.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 bg-[var(--accent-color)] text-black font-[var(--font-mono)] font-bold text-sm uppercase tracking-wider px-8 py-4 hover:bg-white transition-colors"
              >
                Deploy Now <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href={BRANDING.demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 border border-[var(--border-color)] text-[var(--text-primary)] font-[var(--font-mono)] font-bold text-sm uppercase tracking-wider px-8 py-4 hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] hover:bg-[rgba(204,255,0,0.05)] transition-all"
              >
                Talk to an Expert
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
