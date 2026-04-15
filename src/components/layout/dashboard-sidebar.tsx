"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/deploy", label: "Deploy Agent" },
  { href: "/dashboard/instances", label: "My Agents" },
  { href: "/dashboard/monitoring", label: "Monitoring" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/dashboard/subscriptions", label: "Subscriptions" },
  { href: "/dashboard/api-keys", label: "API Keys" },
  { href: "/dashboard/ssh-keys", label: "SSH Keys" },
  { href: "/dashboard/team", label: "Team" },
  { href: "/dashboard/audit-log", label: "Audit Log" },
  { href: "/dashboard/account", label: "Settings" },
]

export function DashboardSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex w-64 flex-col border-r border-[var(--border-color)] bg-[var(--card-bg)] p-6">
      <Link
        href="/"
        className="text-xl font-bold uppercase tracking-[0.05em] text-[var(--text-primary)] mb-10"
        style={{ fontFamily: "var(--font-display)" }}
      >
        SovereignML
      </Link>
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
    </aside>
  )
}
