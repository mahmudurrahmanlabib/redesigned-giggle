"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/instances", label: "Instances" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/revenue", label: "Revenue" },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex w-64 flex-col border-r border-[var(--border-color)] bg-[var(--card-bg)] p-6">
      <Link
        href="/admin"
        className="text-xl font-bold uppercase tracking-[0.05em] text-[var(--text-primary)] mb-2"
        style={{ fontFamily: "var(--font-display)" }}
      >
        SovereignML
      </Link>
      <p
        className="text-[0.7rem] text-[var(--accent-color)] uppercase tracking-[0.15em] mb-8"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        [ ADMIN_PANEL ]
      </p>
      <nav className="space-y-1 flex-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-3 py-2.5 text-sm uppercase tracking-[0.03em] transition-all duration-200 border-l-2 ${
              pathname === item.href
                ? "border-l-[var(--accent-color)] text-[var(--accent-color)] bg-[var(--accent-dim)]"
                : "border-l-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-l-[var(--border-color)]"
            }`}
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <Link
        href="/dashboard"
        className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        &lt;- Back to Dashboard
      </Link>
    </aside>
  )
}
