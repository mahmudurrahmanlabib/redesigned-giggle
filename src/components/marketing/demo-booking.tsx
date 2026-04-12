"use client"

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { BRANDING } from "@/configs/branding"

export function DemoBooking() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-10 md:p-16 text-center relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(204,255,0,0.05)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative z-10">
        <div className="font-[var(--font-mono)] text-[var(--accent-color)] text-sm uppercase tracking-widest mb-4 opacity-80">
          [ Enterprise ]
        </div>

        <h2 className="font-[var(--font-display)] text-3xl md:text-4xl font-bold uppercase tracking-wide text-[var(--text-primary)] mb-4">
          Get a Custom AI System<br />Built for Your Business
        </h2>

        <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto mb-4">
          Our team will design, build, and deploy a multi-agent AI system
          tailored to your exact workflows and requirements.
        </p>

        <ul className="flex flex-col sm:flex-row gap-4 justify-center font-[var(--font-mono)] text-sm text-[var(--text-secondary)] mb-8">
          <li className="before:content-['✓'] before:text-[var(--accent-color)] before:mr-2">
            Custom agent design
          </li>
          <li className="before:content-['✓'] before:text-[var(--accent-color)] before:mr-2">
            Dedicated engineer
          </li>
          <li className="before:content-['✓'] before:text-[var(--accent-color)] before:mr-2">
            Production deployment
          </li>
        </ul>

        <a
          href={BRANDING.demoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-[var(--accent-color)] text-black font-[var(--font-mono)] font-bold text-sm uppercase tracking-wider px-8 py-4 hover:bg-white transition-colors shadow-[0_0_20px_rgba(204,255,0,0.1)]"
        >
          Book a Strategy Call <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </motion.div>
  )
}
