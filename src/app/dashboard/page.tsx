import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
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

  const [instances, subscriptions] = await Promise.all([
    prisma.instance.findMany({
      where: { userId: session.user.id },
      include: { region: true, serverConfig: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.subscription.findMany({
      where: { userId: session.user.id },
      include: { plan: true },
    }),
  ])

  const activeInstances = instances.filter((i) => i.status === "running").length
  const activeSubs = subscriptions.filter((s) => s.status === "active").length

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
          { label: "Active Agents", value: activeInstances.toString(), accent: true, hint: `of ${instances.length} total` },
          { label: "Credits Remaining", value: "12,480", accent: false, hint: "~3.2k requests left", dummy: true },
          { label: "Monthly Spend", value: "$94.20", accent: false, hint: "across " + activeSubs + " subs" },
          { label: "Incidents 24h", value: "0", accent: false, hint: "all systems up", dummy: true },
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
              {stat.hint}{stat.dummy ? " ·" : ""}
              {stat.dummy && <span className="text-amber-400/80"> dummy</span>}
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
        {instances.length === 0 ? (
          <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-12 text-center">
            <p className="text-[var(--text-secondary)] mb-4">No agents deployed yet. Launch your first AI agent.</p>
            <Link href="/dashboard/deploy" className="btn-primary inline-flex text-sm px-6 py-3">
              Deploy Agent
            </Link>
          </div>
        ) : (
          <div className="space-y-0">
            {instances.map((instance) => (
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
