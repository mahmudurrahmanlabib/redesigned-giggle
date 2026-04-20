import { auth } from "@/auth"
import { db, eq, desc, subscriptions } from "@/db"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"

const STATUS_STYLES: Record<string, string> = {
  active: "bg-[var(--accent-dim)] text-[var(--accent-color)] border-[var(--accent-color)]/30",
  past_due: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  canceled: "bg-red-500/10 text-red-400 border-red-500/30",
  incomplete: "bg-[var(--card-bg)] text-[var(--text-secondary)] border-[var(--border-color)]",
}

export default async function BillingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const rows = await db.query.subscriptions.findMany({
    where: eq(subscriptions.userId, session.user.id),
    with: {
      plan: true,
      instance: { with: { serverConfig: true, region: true } },
    },
    orderBy: desc(subscriptions.createdAt),
  })

  const totalMonthly = rows
    .filter((s) => s.status === "active" && s.instance)
    .reduce((sum, s) => {
      if (!s.instance) return sum
      return sum + (s.interval === "year"
        ? s.instance.serverConfig.priceYearly / 12
        : s.instance.serverConfig.priceMonthly)
    }, 0)

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1
          className="text-2xl font-bold uppercase tracking-[0.02em] text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Billing
        </h1>
        <p className="text-[var(--text-secondary)] mt-1 text-sm">Your subscriptions and billing overview</p>
      </div>

      <div className="grid gap-0 sm:grid-cols-2">
        <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-6">
          <p className="text-xs text-[var(--text-secondary)] uppercase tracking-[0.1em]" style={{ fontFamily: "var(--font-mono)" }}>
            Estimated Monthly Cost
          </p>
          <p className="text-3xl font-bold mt-2 text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
            ${totalMonthly.toFixed(2)}<span className="text-[var(--text-secondary)] text-lg font-normal">/mo</span>
          </p>
        </div>
        <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-6">
          <p className="text-xs text-[var(--text-secondary)] uppercase tracking-[0.1em]" style={{ fontFamily: "var(--font-mono)" }}>
            Active Subscriptions
          </p>
          <p className="text-3xl font-bold mt-2 text-[var(--accent-color)]" style={{ fontFamily: "var(--font-display)" }}>
            {rows.filter(s => s.status === "active").length}
          </p>
        </div>
      </div>

      <div>
        <h2
          className="text-lg font-bold uppercase tracking-[0.02em] text-[var(--text-primary)] mb-4"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Subscriptions
        </h2>
        {rows.length === 0 ? (
          <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-8 text-center">
            <p className="text-[var(--text-secondary)]">No subscriptions yet. Deploy an instance to get started.</p>
          </div>
        ) : (
          <div className="space-y-0">
            {rows.map((sub) => (
              <div key={sub.id} className="border border-[var(--border-color)] border-t-0 first:border-t bg-[var(--card-bg)] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-[var(--text-primary)] font-medium">{sub.plan.name} Plan</h3>
                      <Badge className={STATUS_STYLES[sub.status] || STATUS_STYLES.incomplete}>
                        {sub.status}
                      </Badge>
                    </div>
                    {sub.instance && (
                      <p className="text-sm text-[var(--text-secondary)] mt-1">
                        {sub.instance.name} &middot; {sub.instance.region.name} &middot; {sub.instance.serverConfig.label}
                      </p>
                    )}
                    <p className="text-xs text-[var(--text-secondary)] mt-1" style={{ fontFamily: "var(--font-mono)" }}>
                      Billing: {sub.interval === "year" ? "Yearly" : "Monthly"}
                      {sub.currentPeriodEnd && (
                        <> &middot; Renews {sub.currentPeriodEnd.toISOString().slice(0, 10)}</>
                      )}
                    </p>
                  </div>
                  {sub.instance && (
                    <div className="text-right">
                      <p className="text-[var(--text-primary)] font-bold" style={{ fontFamily: "var(--font-display)" }}>
                        ${sub.interval === "year"
                          ? sub.instance.serverConfig.priceYearly.toFixed(2)
                          : sub.instance.serverConfig.priceMonthly.toFixed(2)}
                        <span className="text-[var(--text-secondary)] text-sm font-normal">
                          /{sub.interval === "year" ? "yr" : "mo"}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-5">
          <p className="text-[10px] uppercase tracking-[0.1em] font-mono text-[var(--text-secondary)]">Credits</p>
          <p className="text-3xl font-bold text-[var(--accent-color)] font-mono mt-2">12,480</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">~3.2k requests left</p>
          <button className="btn-primary w-full text-xs mt-4 py-2">+ Top Up Credits</button>
          <p className="text-[10px] font-mono text-amber-400/80 mt-2">⚠ one-time purchase flow pending</p>
        </div>
        <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-5">
          <p className="text-[10px] uppercase tracking-[0.1em] font-mono text-[var(--text-secondary)]">Usage Alerts</p>
          <div className="mt-3 space-y-2 text-xs">
            {[50, 80, 95].map((p) => (
              <label key={p} className="flex items-center justify-between">
                <span className="font-mono text-[var(--text-primary)]">Alert at {p}%</span>
                <input type="checkbox" defaultChecked={p !== 50} className="accent-[var(--accent-color)]" />
              </label>
            ))}
          </div>
          <p className="text-[10px] font-mono text-amber-400/80 mt-3">⚠ notification delivery pending</p>
        </div>
        <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-5">
          <p className="text-[10px] uppercase tracking-[0.1em] font-mono text-[var(--text-secondary)]">Payment Method</p>
          <p className="text-sm text-[var(--text-primary)] font-mono mt-3">•••• 4242</p>
          <p className="text-xs text-[var(--text-secondary)]">Expires 12/27</p>
          <button className="w-full text-xs mt-4 py-2 border border-[var(--border-color)] text-[var(--text-primary)] font-mono uppercase tracking-[0.08em] hover:border-[var(--accent-color)]">
            Update Card
          </button>
          <p className="text-[10px] font-mono text-amber-400/80 mt-2">⚠ Stripe portal link pending</p>
        </div>
      </div>

      <div>
        <h2
          className="text-lg font-bold uppercase tracking-[0.02em] text-[var(--text-primary)] mb-4"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Invoices
        </h2>
        <div className="border border-[var(--border-color)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-secondary)] font-mono border-b border-[var(--border-color)]">
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Invoice</th>
                <th className="text-left px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">PDF</th>
              </tr>
            </thead>
            <tbody>
              {[
                { d: "2026-04-01", n: "INV-2026-0042", a: "$94.20", s: "paid" },
                { d: "2026-03-01", n: "INV-2026-0031", a: "$94.20", s: "paid" },
                { d: "2026-02-01", n: "INV-2026-0022", a: "$76.80", s: "paid" },
                { d: "2026-01-01", n: "INV-2026-0013", a: "$48.00", s: "paid" },
              ].map((inv) => (
                <tr key={inv.n} className="border-b border-[var(--border-color)]/50">
                  <td className="px-4 py-3 text-[var(--text-secondary)] font-mono text-xs">{inv.d}</td>
                  <td className="px-4 py-3 text-[var(--text-primary)] font-mono text-xs">{inv.n}</td>
                  <td className="px-4 py-3 text-[var(--text-primary)]">{inv.a}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] uppercase tracking-[0.08em] font-mono px-2 py-0.5 border border-[var(--accent-color)]/40 text-[var(--accent-color)] bg-[var(--accent-dim)]">
                      {inv.s}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-xs uppercase tracking-[0.08em] font-mono text-[var(--accent-color)] hover:underline">
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] font-mono text-amber-400/80 mt-2">⚠ dummy invoices — Stripe Invoice sync pending</p>
      </div>
    </div>
  )
}
