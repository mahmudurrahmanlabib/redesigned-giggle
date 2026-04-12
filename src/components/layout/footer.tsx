import Link from "next/link"
import { BRANDING } from "@/configs/branding"

export default function Footer() {
  return (
    <footer className="border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
      <div className="max-w-[1400px] mx-auto px-8 pt-24 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr] gap-12 mb-24">
          <div>
            <Link
              href="/"
              className="block text-[1.5rem] font-bold uppercase tracking-[0.05em] text-[var(--text-primary)] mb-4"
              style={{ fontFamily: "var(--font-display)" }}
            >
              SovereignML
            </Link>
            <p className="text-[var(--text-secondary)] text-sm max-w-xs leading-relaxed">
              {BRANDING.tagline}
            </p>
            <div className="mt-6 flex items-center gap-2">
              <span
                className="text-[var(--accent-color)] text-xs uppercase tracking-[0.1em] opacity-80"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                [ SYSTEM_ONLINE ]
              </span>
            </div>
          </div>

          {[
            {
              title: "Product",
              links: [
                { href: "/#pricing", label: "Pricing" },
                { href: "/docs", label: "Documentation" },
                { href: "/#agents", label: "Agents" },
                { href: "/login?deploy=true", label: "Launch an Agent" },
              ],
            },
            {
              title: "Resources",
              links: [
                { href: "/#demo-booking", label: "Book a Demo" },
                { href: "/docs#faq", label: "FAQ" },
                { href: BRANDING.github, label: "GitHub" },
              ],
            },
            {
              title: "Legal",
              links: [
                { href: "#", label: "Terms of Service" },
                { href: "#", label: "Privacy Policy" },
                { href: "#", label: "SLA" },
              ],
            },
          ].map((section) => (
            <div key={section.title}>
              <h4
                className="text-[var(--accent-color)] text-[0.9rem] uppercase mb-8 tracking-[0.05em]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {section.title}
              </h4>
              <ul className="space-y-4">
                {section.links.map((link) => {
                  const className =
                    "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:translate-x-[5px] text-sm transition-all duration-200 inline-block"
                  const isExternal = /^https?:\/\//i.test(link.href)
                  const isHashRoute = link.href.startsWith("/") && link.href.includes("#")
                  if (isExternal || isHashRoute) {
                    return (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          className={className}
                          {...(isExternal
                            ? { target: "_blank", rel: "noopener noreferrer" }
                            : {})}
                        >
                          {link.label}
                        </a>
                      </li>
                    )
                  }
                  return (
                    <li key={link.label}>
                      <Link href={link.href} className={className}>
                        {link.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="text-center border-t border-[var(--border-color)] pt-8">
          <p
            className="text-[var(--text-secondary)] text-[0.8rem] tracking-[0.05em]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            &copy; {new Date().getFullYear()} {BRANDING.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
