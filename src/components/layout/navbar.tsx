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
          backgroundColor: "rgba(10, 10, 10, 0.8)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
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
              { href: "/#pricing", label: "Pricing" },
              { href: "/docs", label: "Docs" },
              { href: "/community", label: "Community" },
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
            <Link
              href="/login"
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[0.85rem] uppercase tracking-[0.05em] transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Log In
            </Link>
            <Link href="/login?deploy=true" className="btn-primary text-sm px-6 py-2.5">
              Deploy Now
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
        <div className="fixed inset-0 bg-black z-[1000] flex flex-col items-center justify-center gap-8">
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
            { href: "/#pricing", label: "Pricing" },
            { href: "/docs", label: "Docs" },
            { href: "/community", label: "Community" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-white text-2xl uppercase tracking-[0.05em] opacity-90 hover:opacity-100 hover:text-[var(--accent-color)] transition-all"
              style={{ fontFamily: "var(--font-mono)" }}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <hr className="border-[var(--border-color)] w-32" />
          <Link
            href="/login"
            className="text-[var(--text-secondary)] text-lg uppercase tracking-[0.05em]"
            style={{ fontFamily: "var(--font-mono)" }}
            onClick={() => setMobileOpen(false)}
          >
            Log In
          </Link>
          <Link href="/login?deploy=true" className="btn-primary text-base px-8 py-3" onClick={() => setMobileOpen(false)}>
            Deploy Now
          </Link>
        </div>
      )}
    </>
  )
}
