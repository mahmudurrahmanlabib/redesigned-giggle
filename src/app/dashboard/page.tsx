import { auth } from "@/auth"
import { db, eq, and, gte, sql, instances, subscriptions, users, usageEvents, instanceLogs } from "@/db"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

const STATUS_STYLES: Record<string, string> = {
  running: "bg-[var(--accent-dim)] text-[var(--accent-color)] border-[var(--accent-color)]/30",
  provisioning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  stopped: "bg-[var(--card-bg)] text-[var(--text-secondary)] border-[var(--border-color)]",
  failed: "bg-red-500/10 text-red-400 border-red-500/30",
  deleted: "bg-[var(--card-bg)] text-[var(--text-secondary)]/50 border-[var(--border-color)]",
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [allInstances, allSubscriptions, user, usage30Rows, incidents24Rows] = await Promise.all([
    db.query.instances.findMany({
      where: eq(instances.userId, session.user.id),
      with: { region: true, serverConfig: true },
      orderBy: (t, { desc }) => desc(t.createdAt),
    }),
    db.query.subscriptions.findMany({
      where: eq(subscriptions.userId, session.user.id),
      with: { plan: true },
    }),
    db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { credits: true },
    }),
    db
      .select({ total: sql<number>`coalesce(sum(${usageEvents.amount}), 0)` })
      .from(usageEvents)
      .where(and(eq(usageEvents.userId, session.user.id), gte(usageEvents.createdAt, since30))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(instanceLogs)
      .innerJoin(instances, eq(instanceLogs.instanceId, instances.id))
      .where(
        and(
          eq(instances.userId, session.user.id),
          eq(instanceLogs.level, "error"),
          gte(instanceLogs.createdAt, since24)
        )
      ),
  ])

  const activeInstances = allInstances.filter((i) => i.status === "running").length
  const activeSubs = allSubscriptions.filter((s) => s.status === "active").length
  const monthlySpend = allInstances
    .filter((i) => i.status === "running")
    .reduce((sum, i) => sum + (i.serverConfig?.priceMonthly ?? 0), 0)
  const credits = user?.credits ?? 0
  const usageTotal = Number(usage30Rows[0]?.total ?? 0)
  const incidents24 = Number(incidents24Rows[0]?.count ?? 0)

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold uppercase tracking-[0.02em] text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Dashboard
          </h1>
          <p className="text-[var(--text-secondary)] mt-1 text-sm">Manage your AI agents</p>
        </div>
        <Link href="/dashboard/deploy" className="btn-primary text-sm px-5 py-2.5">
          + Deploy New
        </Link>
      </div>

      <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active Agents", value: activeInstances.toString(), accent: true, hint: `of ${allInstances.length} total` },
          { label: "Credits Remaining", value: credits.toLocaleString(), accent: false, hint: `${usageTotal.toLocaleString()} used last 30d` },
          { label: "Monthly Spend", value: `$${monthlySpend.toFixed(2)}`, accent: false, hint: `across ${activeSubs} sub${activeSubs === 1 ? "" : "s"}` },
          { label: "Incidents 24h", value: incidents24.toString(), accent: false, hint: incidents24 === 0 ? "all systems up" : "check monitoring" },
        ].map((stat) => (
          <div key={stat.label} className="border border-[var(--border-color)] bg-[var(--card-bg)] p-6">
            <p className="text-xs text-[var(--text-secondary)] uppercase tracking-[0.1em]" style={{ fontFamily: "var(--font-mono)" }}>
              {stat.label}
            </p>
            <p
              className={`text-3xl font-bold mt-2 ${stat.accent ? "text-[var(--accent-color)]" : "text-[var(--text-primary)]"}`}
              style={{ fontFamily: "var(--font-display)" }}
            >
              {stat.value}
            </p>
            <p className="text-[10px] font-mono text-[var(--text-secondary)] mt-1">
              {stat.hint}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/dashboard/deploy"
          className="border border-[var(--border-color)] bg-[var(--card-bg)] p-5 hover:border-[var(--accent-color)] transition-colors"
        >
          <p className="text-[10px] uppercase tracking-[0.1em] font-mono text-[var(--accent-color)]">Quick Action</p>
          <p className="text-lg font-bold text-[var(--text-primary)] mt-2">Deploy new agent →</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">From template or scratch</p>
        </Link>
        <Link
          href="/dashboard/monitoring"
          className="border border-[var(--border-color)] bg-[var(--card-bg)] p-5 hover:border-[var(--accent-color)] transition-colors"
        >
          <p className="text-[10px] uppercase tracking-[0.1em] font-mono text-[var(--accent-color)]">Health</p>
          <p className="text-lg font-bold text-[var(--text-primary)] mt-2">Monitoring →</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">Uptime + latency across agents</p>
        </Link>
        <Link
          href="/dashboard/billing"
          className="border border-[var(--border-color)] bg-[var(--card-bg)] p-5 hover:border-[var(--accent-color)] transition-colors"
        >
          <p className="text-[10px] uppercase tracking-[0.1em] font-mono text-[var(--accent-color)]">Billing</p>
          <p className="text-lg font-bold text-[var(--text-primary)] mt-2">Credits & invoices →</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">Top up or download invoices</p>
        </Link>
      </div>

      <div>
        <h2
          className="text-lg font-bold uppercase tracking-[0.02em] text-[var(--text-primary)] mb-4"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Your Agents
        </h2>
        {allInstances.length === 0 ? (
          <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-12 text-center">
            <p className="text-[var(--text-secondary)] mb-4">No agents deployed yet. Launch your first AI agent.</p>
            <Link href="/dashboard/deploy" className="btn-primary inline-flex text-sm px-6 py-3">
              Deploy Agent
            </Link>
          </div>
        ) : (
          <div className="space-y-0">
            {allInstances.map((instance) => (
              <Link
                key={instance.id}
                href={`/dashboard/instances/${instance.id}`}
                className="block border border-[var(--border-color)] border-t-0 first:border-t bg-[var(--card-bg)] p-5 hover:bg-[var(--card-hover)] transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[var(--text-primary)] font-medium">{instance.name}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5" style={{ fontFamily: "var(--font-mono)" }}>
                      {instance.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      <p className="text-[var(--text-primary)]">{instance.region.flag} {instance.region.name}</p>
                      <p className="text-[var(--text-secondary)] text-xs" style={{ fontFamily: "var(--font-mono)" }}>
                        {instance.serverConfig.label} &middot; {instance.serverConfig.vcpu} vCPU &middot; {instance.serverConfig.ramGb} GB
                      </p>
                    </div>
                    <Badge className={STATUS_STYLES[instance.status] || STATUS_STYLES.stopped}>
                      {instance.status}
                    </Badge>
                  </div>
                </div>
                {instance.ipAddress && (
                  <p className="text-xs text-[var(--text-secondary)] mt-2" style={{ fontFamily: "var(--font-mono)" }}>
                    IP: {instance.ipAddress}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
