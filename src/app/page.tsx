"use client"

import Link from "next/link"
import { useState } from "react"
import Navbar from "@/components/layout/navbar"
import Footer from "@/components/layout/footer"
import { PLANS } from "@/configs/plans"
import { AGENT_CATEGORIES } from "@/configs/agent-categories"
import { BRANDING } from "@/configs/branding"
import { TerminalAnimation } from "@/components/marketing/terminal-animation"
import { AgentCategoryCard } from "@/components/marketing/agent-category-card"
import { SmartPlanner } from "@/components/marketing/smart-planner"
import { DemoBooking } from "@/components/marketing/demo-booking"
import { UpgradePath } from "@/components/marketing/upgrade-path"
import {
  Rocket,
  Shield,
  Activity,
  Layers,
  TrendingUp,
  Wrench,
  Globe,
  GitBranch,
  Cpu,
  ChevronDown,
  Check,
} from "lucide-react"

const features = [
  { title: "One-Click Deploy", desc: "Launch production-ready AI agents in minutes. Pre-configured, zero setup required.", marker: "DEPLOY", icon: Rocket },
  { title: "100% Owned Data", desc: "Your agents, your data. No shared infrastructure, no third-party access. Full sovereignty.", marker: "PRIVACY", icon: Shield },
  { title: "Real-Time Monitoring", desc: "Live agent health metrics, performance tracking, and proactive alerts when things drift.", marker: "HEALTH", icon: Activity },
  { title: "All Agent Types", desc: "From automation to support to sales — deploy any agent type for any business need.", marker: "TYPES", icon: Layers },
  { title: "Auto-Scaling", desc: "Agents scale automatically with demand. Handle traffic spikes without manual intervention.", marker: "SCALE", icon: TrendingUp },
  { title: "Managed Optimization", desc: "We tune your agents for peak performance. Not just infra — outcomes.", marker: "OPS", icon: Wrench },
  { title: "Global Deployment", desc: "Deploy agents across multiple regions. Choose the location closest to your users.", marker: "GEO", icon: Globe },
  { title: "Version Control", desc: "Roll back to any agent version with a single click. Safe, controlled updates.", marker: "VERSION", icon: GitBranch },
  { title: "Multi-Agent Orchestration", desc: "Run multiple agents that communicate and coordinate. Build complex AI workflows.", marker: "MULTI", icon: Cpu },
]

const useCases = [
  {
    tag: "E-Commerce",
    title: "Automate Support & Upsell",
    desc: "Deploy a support agent that handles 80% of tickets and a sales agent that drives upsell revenue — 24/7.",
    stat: "90% ticket deflection",
  },
  {
    tag: "SaaS",
    title: "DevOps Agent Reduces Incidents",
    desc: "Monitor logs, detect anomalies, and auto-resolve common infrastructure issues before they page your team.",
    stat: "60% fewer incidents",
  },
  {
    tag: "Agency",
    title: "White-Label AI for Clients",
    desc: "Build and deploy custom AI agents for your clients. Each with their own config, branding, and data isolation.",
    stat: "10x service capacity",
  },
]

const faqs = [
  {
    q: "What is SovereignML?",
    a: "SovereignML is an AI operations platform that lets you deploy, manage, and scale intelligent agents that automate real business tasks — from customer support to DevOps to content generation.",
  },
  {
    q: "What types of AI agents can I deploy?",
    a: "We support 7 agent categories: Automation, DevOps, Support, Research, Content, Sales, and Custom. Each can be configured to your exact requirements.",
  },
  {
    q: "Do I need AI/ML expertise to use SovereignML?",
    a: "No. Our platform handles the complexity. You choose what you want to automate, and we configure and optimize the agent for you. For advanced use cases, our team can build custom solutions.",
  },
  {
    q: "How is pricing structured?",
    a: "We offer three tiers: Starter ($5/mo for 1 agent), Pro ($29/mo for up to 10 agents), and Enterprise ($199/mo for unlimited agents with dedicated support). All plans include monitoring and health checks.",
  },
  {
    q: "Can I get a custom AI system built for my business?",
    a: "Absolutely. Book a strategy call and our team will design, build, and deploy a multi-agent system tailored to your exact workflows and requirements.",
  },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-[var(--border-color)] transition-all duration-200 hover:border-[var(--accent-color)]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center p-5 text-left cursor-pointer"
      >
        <span className="font-[var(--font-display)] text-lg font-bold uppercase tracking-wide text-[var(--text-primary)]">
          {q}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-[var(--accent-color)] transition-transform duration-200 shrink-0 ml-4 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-5 pb-5">
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  )
}

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="relative z-10 min-h-screen">
        {/* ─── HERO ─── */}
        <section className="relative pt-[calc(var(--nav-height,80px)+8rem)] pb-24 min-h-screen flex items-center overflow-hidden">
          <div className="absolute inset-0 z-0 pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_1px,rgba(255,255,255,0.02)_2px,rgba(255,255,255,0.02)_3px)]" />
          <div className="max-w-[1400px] mx-auto px-8 relative z-10 w-full grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-12 items-center">
            <div>
              <div className="font-[var(--font-mono)] text-[var(--accent-color)] text-sm mb-6 opacity-80">
                [ SYSTEM_ONLINE ]
              </div>

              <h1 className="font-[var(--font-display)] text-[clamp(2.5rem,5vw,5rem)] font-bold leading-[1.05] uppercase tracking-[0.02em] text-[var(--text-primary)] mb-6">
                Launch AI Agents<br />
                That Actually<br />
                <span className="text-[var(--accent-color)]" style={{ textShadow: "0 0 20px rgba(204,255,0,0.3)" }}>
                  Work.
                </span>
              </h1>

              <p className="text-[var(--text-secondary)] text-lg md:text-xl max-w-[600px] mb-8 border-l-2 border-[var(--accent-color)] pl-6 leading-relaxed">
                Deploy intelligent agents that automate real tasks — support, DevOps, sales, content, and more. Full ownership, zero complexity.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/login?deploy=true"
                  className="btn-primary text-base px-8 py-4 text-center"
                >
                  Deploy Now
                </Link>
                <a
                  href={BRANDING.demoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center border border-[var(--border-color)] text-[var(--text-primary)] font-[var(--font-mono)] font-bold text-sm uppercase tracking-[0.05em] px-8 py-4 hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] hover:bg-[rgba(204,255,0,0.05)] transition-all"
                >
                  Book a Demo
                </a>
              </div>
            </div>

            <div className="hidden lg:block">
              <TerminalAnimation />
            </div>
          </div>
        </section>

        {/* ─── TRUSTED BY ─── */}
        <section className="border-y border-[var(--border-color)] grid-through-alt py-6 text-center overflow-hidden">
          <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.1em] text-[var(--accent-color)] opacity-60 mb-4">
            Trusted by engineering teams at
          </p>
          <div
            className="relative w-full"
            style={{
              maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
              WebkitMaskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
            }}
          >
            <div className="flex gap-16 w-max animate-[scroll_40s_linear_infinite] hover:[animation-play-state:paused]">
              {[
                "ACME Corp", "LexTech", "MediCore", "FinServe", "DataFlow",
                "CyberDyne", "GlobalNet", "Stark Ind", "Umbrella", "Massive Dynamic",
                "ACME Corp", "LexTech", "MediCore", "FinServe", "DataFlow",
                "CyberDyne", "GlobalNet", "Stark Ind", "Umbrella", "Massive Dynamic",
              ].map((name, i) => (
                <span
                  key={`${name}-${i}`}
                  className="font-[var(--font-display)] font-bold text-xl text-[var(--text-secondary)] uppercase tracking-[0.05em] whitespace-nowrap opacity-50 hover:opacity-100 hover:text-[var(--text-primary)] transition-all duration-300 cursor-default"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ─── AGENT CATEGORIES ─── */}
        <section id="agents" className="py-24">
          <div className="max-w-[1400px] mx-auto px-8">
            <div className="border-l-4 border-[var(--accent-color)] pl-8 mb-12 max-w-[800px]">
              <h2 className="font-[var(--font-display)] text-[clamp(2rem,4vw,3.5rem)] font-bold uppercase tracking-[0.02em] text-[var(--text-primary)] mb-2">
                Choose Your Agent
              </h2>
              <p className="text-[var(--text-secondary)] text-lg">
                Deploy purpose-built AI agents for any business function.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {AGENT_CATEGORIES.map((cat) => (
                <AgentCategoryCard key={cat.slug} category={cat} />
              ))}
            </div>
          </div>
        </section>

        {/* ─── SMART PLANNER ─── */}
        <section id="planner" className="py-24 grid-through-alt border-y border-[var(--border-color)]">
          <div className="max-w-[1400px] mx-auto px-8">
            <div className="border-l-4 border-[var(--accent-color)] pl-8 mb-12 max-w-[800px]">
              <h2 className="font-[var(--font-display)] text-[clamp(2rem,4vw,3.5rem)] font-bold uppercase tracking-[0.02em] text-[var(--text-primary)] mb-2">
                AI Agent Planner
              </h2>
              <p className="text-[var(--text-secondary)] text-lg">
                Tell us what you need — we'll recommend the right agent and configuration.
              </p>
            </div>

            <SmartPlanner />
          </div>
        </section>

        {/* ─── FEATURES ─── */}
        <section id="features" className="py-24">
          <div className="max-w-[1400px] mx-auto px-8">
            <div className="border-l-4 border-[var(--accent-color)] pl-8 mb-12 max-w-[800px]">
              <h2 className="font-[var(--font-display)] text-[clamp(2rem,4vw,3.5rem)] font-bold uppercase tracking-[0.02em] text-[var(--text-primary)] mb-2">
                Complete Control Over Your AI
              </h2>
              <p className="text-[var(--text-secondary)] text-lg">
                From deployment to optimization, own every step of the lifecycle.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((f, i) => {
                const Icon = f.icon
                return (
                  <div
                    key={f.marker}
                    className="group relative border border-[var(--border-color)] bg-[rgba(10,10,10,0.6)] p-6 min-h-[220px] flex flex-col justify-end transition-all duration-300 hover:border-[var(--accent-color)] hover:bg-[rgba(20,20,20,0.8)] hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
                  >
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-[var(--accent-color)] scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100" />
                    <div className="absolute top-3 right-3 font-[var(--font-mono)] text-[0.65rem] text-[var(--text-secondary)] opacity-40">
                      [ {f.marker} ]
                    </div>
                    <Icon className="w-8 h-8 text-[var(--accent-color)] opacity-80 mb-4" />
                    <h3 className="font-[var(--font-display)] text-xl font-bold uppercase tracking-wide text-[var(--text-primary)] mb-2">
                      {f.title}
                    </h3>
                    <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                      {f.desc}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ─── USE CASES ─── */}
        <section className="py-24 grid-through-alt border-y border-[var(--border-color)]">
          <div className="max-w-[1400px] mx-auto px-8">
            <div className="border-l-4 border-[var(--accent-color)] pl-8 mb-12 max-w-[800px]">
              <h2 className="font-[var(--font-display)] text-[clamp(2rem,4vw,3.5rem)] font-bold uppercase tracking-[0.02em] text-[var(--text-primary)] mb-2">
                Built for Critical Industries
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {useCases.map((uc) => (
                <div
                  key={uc.tag}
                  className="border border-[var(--border-color)] bg-[var(--card-bg)] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent-color)]"
                >
                  <div className="inline-block px-3 py-1 border border-[var(--border-color)] font-[var(--font-mono)] text-xs text-[var(--accent-color)] uppercase tracking-widest mb-4">
                    {uc.tag}
                  </div>
                  <h4 className="font-[var(--font-display)] text-xl font-bold uppercase text-[var(--text-primary)] mb-3">
                    {uc.title}
                  </h4>
                  <p className="text-[var(--text-secondary)] text-sm italic leading-relaxed mb-6">
                    {uc.desc}
                  </p>
                  <div className="border-t border-[var(--border-color)] pt-4 font-[var(--font-mono)] text-sm text-[var(--text-primary)] flex items-center">
                    <span className="text-[var(--accent-color)] mr-2">&gt;</span>
                    {uc.stat}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── PRICING ─── */}
        <section id="pricing" className="py-24">
          <div className="max-w-[1400px] mx-auto px-8">
            <div className="border-l-4 border-[var(--accent-color)] pl-8 mb-12 max-w-[800px]">
              <h2 className="font-[var(--font-display)] text-[clamp(2rem,4vw,3.5rem)] font-bold uppercase tracking-[0.02em] text-[var(--text-primary)] mb-2">
                Simple, Transparent Pricing
              </h2>
              <p className="text-[var(--text-secondary)] text-lg">
                Start small, scale as you grow. No hidden fees.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PLANS.map((plan) => (
                <div
                  key={plan.slug}
                  className={`relative border p-8 transition-all duration-300 hover:-translate-y-1 ${
                    plan.highlight
                      ? "border-[var(--accent-color)] bg-[rgba(204,255,0,0.03)]"
                      : "border-[var(--border-color)] bg-[var(--card-bg)]"
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-6 bg-[var(--accent-color)] text-black font-[var(--font-mono)] text-xs font-bold uppercase tracking-widest px-3 py-1">
                      Most Popular
                    </div>
                  )}

                  <h3 className="font-[var(--font-display)] text-2xl font-bold uppercase text-[var(--text-primary)] mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-[var(--text-secondary)] text-sm mb-4">
                    {plan.description}
                  </p>

                  <div className="mb-6">
                    <span className="font-[var(--font-display)] text-4xl font-bold text-[var(--text-primary)]">
                      ${plan.displayPriceMonthly}
                    </span>
                    <span className="text-[var(--text-secondary)] text-sm">/mo</span>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm">
                        <Check className="w-4 h-4 text-[var(--accent-color)] shrink-0 mt-0.5" />
                        <span className="text-[var(--text-secondary)]">{f}</span>
                      </li>
                    ))}
                  </ul>

                  {plan.tier === "enterprise" ? (
                    <a
                      href={BRANDING.demoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center border border-[var(--border-color)] text-[var(--text-primary)] font-[var(--font-mono)] font-bold text-sm uppercase tracking-wider px-6 py-3 hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-all"
                    >
                      Book a Demo
                    </a>
                  ) : (
                    <Link
                      href="/login?deploy=true"
                      className={`block text-center font-[var(--font-mono)] font-bold text-sm uppercase tracking-wider px-6 py-3 transition-all ${
                        plan.highlight
                          ? "bg-[var(--accent-color)] text-black hover:bg-white"
                          : "border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)]"
                      }`}
                    >
                      Get Started
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── DEMO BOOKING ─── */}
        <section id="demo-booking" className="py-24 grid-through-alt border-y border-[var(--border-color)]">
          <div className="max-w-[1400px] mx-auto px-8">
            <DemoBooking />
          </div>
        </section>

        {/* ─── UPGRADE PATH ─── */}
        <section className="py-24">
          <div className="max-w-[1400px] mx-auto px-8">
            <div className="border-l-4 border-[var(--accent-color)] pl-8 mb-12 max-w-[800px]">
              <h2 className="font-[var(--font-display)] text-[clamp(2rem,4vw,3.5rem)] font-bold uppercase tracking-[0.02em] text-[var(--text-primary)] mb-2">
                Your Growth Path
              </h2>
              <p className="text-[var(--text-secondary)] text-lg">
                Start with one agent. Scale to an entire AI workforce.
              </p>
            </div>

            <UpgradePath />
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section className="py-24 grid-through-alt border-y border-[var(--border-color)]">
          <div className="max-w-[1400px] mx-auto px-8">
            <div className="border-l-4 border-[var(--accent-color)] pl-8 mb-12 max-w-[800px]">
              <h2 className="font-[var(--font-display)] text-[clamp(2rem,4vw,3.5rem)] font-bold uppercase tracking-[0.02em] text-[var(--text-primary)] mb-2">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="max-w-3xl space-y-3">
              {faqs.map((faq) => (
                <FAQItem key={faq.q} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>
        </section>

        {/* ─── FINAL CTA ─── */}
        <section className="py-24 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(204,255,0,0.05)_0%,transparent_70%)] pointer-events-none" />
          <div className="max-w-[1400px] mx-auto px-8 relative z-10">
            <h2 className="font-[var(--font-display)] text-[clamp(2rem,4vw,3.5rem)] font-bold uppercase tracking-[0.02em] text-[var(--text-primary)] mb-4">
              Ready to Deploy Your First Agent?
            </h2>
            <p className="text-[var(--text-secondary)] text-lg max-w-xl mx-auto mb-8">
              Stop renting intelligence. Start owning it. Launch your AI workforce in minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/login?deploy=true" className="btn-primary text-base px-8 py-4">
                Deploy Now
              </Link>
              <a
                href={BRANDING.demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center border border-[var(--border-color)] text-[var(--text-primary)] font-[var(--font-mono)] font-bold text-sm uppercase tracking-[0.05em] px-8 py-4 hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] hover:bg-[rgba(204,255,0,0.05)] transition-all"
              >
                Book a Demo
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
