import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"

const STATUS_STYLES: Record<string, string> = {
  active: "bg-[var(--accent-dim)] text-[var(--accent-color)] border-[var(--accent-color)]/30",
  past_due: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  canceled: "bg-red-500/10 text-red-400 border-red-500/30",
  incomplete: "bg-white/5 text-[var(--text-secondary)] border-[var(--border-color)]",
}

export default async function BillingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const subscriptions = await prisma.subscription.findMany({
    where: { userId: session.user.id },
    include: {
      plan: true,
      instance: { include: { serverConfig: true, region: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const totalMonthly = subscriptions
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
            {subscriptions.filter(s => s.status === "active").length}
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
        {subscriptions.length === 0 ? (
          <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-8 text-center">
            <p className="text-[var(--text-secondary)]">No subscriptions yet. Deploy an instance to get started.</p>
          </div>
        ) : (
          <div className="space-y-0">
            {subscriptions.map((sub) => (
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
    </div>
  )
}
