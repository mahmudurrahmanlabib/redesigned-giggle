"use client"

import { useState } from "react"
import Link from "next/link"

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <nav
        className="fixed top-5 left-1/2 -translate-x-1/2 w-[95%] max-w-[1400px] h-[70px] z-50 flex items-center clip-corners"
        style={{
          backgroundColor: "var(--nav-bg)",
          backdropFilter: "blur(20px)",
          border: "1px solid var(--nav-border)",
        }}
      >
        <div className="flex justify-between items-center w-full px-8">
          <Link
            href="/"
            className="text-[1.8rem] font-bold tracking-[0.05em] uppercase text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            SovereignML
          </Link>

          <div className="hidden md:flex gap-12">
            {[
              { href: "/#features", label: "Features" },
              { href: "/#agents", label: "Agents" },
              { href: "/#pricing", label: "Pricing" },
              { href: "/docs", label: "Docs" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="relative text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[0.85rem] uppercase tracking-[0.05em] transition-colors after:absolute after:bottom-[-5px] after:left-0 after:w-0 after:h-[1px] after:bg-[var(--accent-color)] hover:after:w-full after:transition-all after:duration-300"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <a
              href="https://tidycal.com/sovereignml/demo"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] text-sm px-5 py-2.5 uppercase tracking-[0.05em] transition-all"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Book Demo
            </a>
            <Link href="/login" className="btn-primary text-sm px-6 py-2.5">
              Log In
            </Link>
          </div>

          <button
            className="md:hidden flex flex-col justify-between w-[30px] h-[21px] bg-transparent border-none cursor-pointer"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <span
              className={`w-full h-[3px] bg-[var(--text-primary)] transition-all duration-300 ${
                mobileOpen ? "translate-y-[9px] rotate-45" : ""
              }`}
            />
            <span
              className={`w-full h-[3px] bg-[var(--text-primary)] transition-all duration-300 ${
                mobileOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`w-full h-[3px] bg-[var(--text-primary)] transition-all duration-300 ${
                mobileOpen ? "-translate-y-[9px] -rotate-45" : ""
              }`}
            />
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-8" style={{ backgroundColor: "var(--mobile-menu-bg)" }}>
          <button
            className="absolute top-8 right-8 text-[var(--text-primary)]"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
          {[
            { href: "/#features", label: "Features" },
            { href: "/#agents", label: "Agents" },
            { href: "/#pricing", label: "Pricing" },
            { href: "/docs", label: "Docs" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[var(--text-primary)] text-2xl uppercase tracking-[0.05em] opacity-90 hover:opacity-100 hover:text-[var(--accent-color)] transition-all"
              style={{ fontFamily: "var(--font-mono)" }}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <hr className="border-[var(--border-color)] w-32" />
          <a
            href="https://tidycal.com/sovereignml/demo"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-[var(--border-color)] text-[var(--text-primary)] text-base px-8 py-3 uppercase tracking-[0.05em]"
            style={{ fontFamily: "var(--font-mono)" }}
            onClick={() => setMobileOpen(false)}
          >
            Book Demo
          </a>
          <Link href="/login" className="btn-primary text-base px-8 py-3" onClick={() => setMobileOpen(false)}>
            Log In
          </Link>
        </div>
      )}
    </>
  )
}
