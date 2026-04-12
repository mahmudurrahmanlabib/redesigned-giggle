"use client"

import {
  Zap,
  Terminal,
  MessageSquare,
  Search,
  PenTool,
  TrendingUp,
  Share2,
  Settings,
} from "lucide-react"
import type { AgentCategory } from "@/configs/agent-categories"

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap,
  Terminal,
  MessageSquare,
  Search,
  PenTool,
  TrendingUp,
  Share2,
  Settings,
}

export function AgentCategoryCard({ category }: { category: AgentCategory }) {
  const Icon = ICON_MAP[category.icon] ?? Zap

  return (
    <div
      className="group relative border border-[var(--border-color)] bg-[rgba(10,10,10,0.6)] p-6 transition-all duration-300 hover:border-[var(--accent-color)] hover:bg-[rgba(20,20,20,0.8)] hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] cursor-pointer"
    >
      <div className="absolute top-0 left-0 w-full h-[2px] bg-[var(--accent-color)] scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100" />

      <div className="absolute top-3 right-3 font-[var(--font-mono)] text-[0.65rem] text-[var(--text-secondary)] opacity-40 uppercase">
        [ {category.slug} ]
      </div>

      <Icon className="w-8 h-8 text-[var(--accent-color)] opacity-80 mb-4" />

      <h3 className="font-[var(--font-display)] text-xl font-bold uppercase tracking-wide text-[var(--text-primary)] mb-2">
        {category.name}
      </h3>

      <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-4">
        {category.description}
      </p>

      <ul className="space-y-1">
        {category.examples.map((ex) => (
          <li
            key={ex}
            className="font-[var(--font-mono)] text-[0.75rem] text-[var(--text-secondary)] before:content-['>'] before:text-[var(--accent-color)] before:mr-2"
          >
            {ex}
          </li>
        ))}
      </ul>
    </div>
  )
}
