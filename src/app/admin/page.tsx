import { db, eq, sql, instances, users, subscriptions } from "@/db"
import Link from "next/link"

export default async function AdminDashboard() {
  const [
    totalUsersRows,
    activeInstancesRows,
    totalInstancesRows,
    activeSubscriptionsRows,
    stoppedInstancesRows,
    bannedUsersRows,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, "user")),
    db.select({ count: sql<number>`count(*)` }).from(instances).where(eq(instances.status, "running")),
    db.select({ count: sql<number>`count(*)` }).from(instances),
    db.select({ count: sql<number>`count(*)` }).from(subscriptions).where(eq(subscriptions.status, "active")),
    db.select({ count: sql<number>`count(*)` }).from(instances).where(eq(instances.status, "stopped")),
    db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.isBanned, true)),
  ])

  const totalUsers = Number(totalUsersRows[0]?.count ?? 0)
  const activeInstances = Number(activeInstancesRows[0]?.count ?? 0)
  const totalInstances = Number(totalInstancesRows[0]?.count ?? 0)
  const activeSubscriptions = Number(activeSubscriptionsRows[0]?.count ?? 0)
  const stoppedInstances = Number(stoppedInstancesRows[0]?.count ?? 0)
  const bannedUsers = Number(bannedUsersRows[0]?.count ?? 0)

  const recentInstances = await db.query.instances.findMany({
    with: { user: true, region: true, serverConfig: true },
    orderBy: (t, { desc }) => desc(t.createdAt),
    limit: 10,
  })

  const stats = [
    { label: "Total Users", value: totalUsers, accent: false },
    { label: "Active Instances", value: activeInstances, accent: true },
    { label: "Total Instances", value: totalInstances, accent: false },
    { label: "Active Subs", value: activeSubscriptions, accent: false },
  ]

  return (
    <div className="space-y-8 max-w-6xl">
      <h1
        className="text-2xl font-bold uppercase tracking-[0.02em] text-[var(--text-primary)]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Admin Dashboard
      </h1>

      <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
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
          </div>
        ))}
      </div>

      <div className="grid gap-0 sm:grid-cols-2">
        <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-6">
          <p className="text-xs text-[var(--text-secondary)] uppercase tracking-[0.1em]" style={{ fontFamily: "var(--font-mono)" }}>Stopped Instances</p>
          <p className="text-3xl font-bold mt-2 text-[var(--text-secondary)]" style={{ fontFamily: "var(--font-display)" }}>{stoppedInstances}</p>
        </div>
        <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-6">
          <p className="text-xs text-[var(--text-secondary)] uppercase tracking-[0.1em]" style={{ fontFamily: "var(--font-mono)" }}>Banned Users</p>
          <p className="text-3xl font-bold mt-2 text-red-400" style={{ fontFamily: "var(--font-display)" }}>{bannedUsers}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-lg font-bold uppercase tracking-[0.02em] text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Recent Instances
          </h2>
          <Link
            href="/admin/instances"
            className="text-sm text-[var(--accent-color)] hover:underline uppercase tracking-[0.05em]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            View All &rarr;
          </Link>
        </div>
        {recentInstances.length === 0 ? (
          <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-8 text-center">
            <p className="text-[var(--text-secondary)]">No instances yet</p>
          </div>
        ) : (
          <div className="space-y-0">
            {recentInstances.map((instance) => (
              <div key={instance.id} className="border border-[var(--border-color)] border-t-0 first:border-t bg-[var(--card-bg)] p-4 flex items-center justify-between hover:bg-[var(--card-hover)] transition-colors">
                <div>
                  <p className="text-[var(--text-primary)] font-medium">{instance.name}</p>
                  <p className="text-sm text-[var(--text-secondary)]">{instance.user.email}</p>
                  <p className="text-xs text-[var(--text-secondary)]" style={{ fontFamily: "var(--font-mono)" }}>{instance.slug}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold uppercase ${
                    instance.status === "running"
                      ? "text-[var(--accent-color)]"
                      : instance.status === "provisioning"
                      ? "text-amber-400"
                      : instance.status === "failed"
                      ? "text-red-400"
                      : "text-[var(--text-secondary)]"
                  }`} style={{ fontFamily: "var(--font-mono)" }}>
                    {instance.status}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {instance.region.flag} {instance.region.name} &middot; {instance.serverConfig.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
