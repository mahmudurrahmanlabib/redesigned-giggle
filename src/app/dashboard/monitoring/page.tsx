import { auth } from "@/auth"
import { db, instances } from "@/db"
import { redirect } from "next/navigation"
import Link from "next/link"
import { whereUserInstancesVisible } from "@/lib/instance-queries"

const STATUS_STYLES: Record<string, string> = {
  running: "text-[var(--accent-color)]",
  provisioning: "text-amber-400",
  stopped: "text-[var(--text-secondary)]",
  failed: "text-red-400",
  deleted: "text-[var(--text-secondary)]/50",
}

export default async function MonitoringPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const visibleInstances = await db.query.instances.findMany({
    where: whereUserInstancesVisible(session.user.id),
    orderBy: (t, { desc }) => desc(t.createdAt),
  })

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1
          className="text-2xl font-bold uppercase tracking-[0.02em] text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Monitoring
        </h1>
        <p className="text-[var(--text-secondary)] mt-1 text-sm">
          Uptime, health, and latency across all your agents. Powered by Uptime Kuma (API integration pending).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Agents" value={visibleInstances.length.toString()} />
        <StatCard
          label="Running"
          value={visibleInstances.filter((i) => i.status === "running").length.toString()}
          accent
        />
        <StatCard label="Incidents 24h" value="0" />
        <StatCard label="Avg Latency" value="142 ms" />
      </div>

      <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-5">
        <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-[0.1em] font-mono mb-4">
          Per-agent status
        </p>
        {visibleInstances.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">
            No agents deployed yet.{" "}
            <Link href="/dashboard/deploy" className="text-[var(--accent-color)] hover:underline">
              Deploy one
            </Link>
            .
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-secondary)] font-mono border-b border-[var(--border-color)]">
                <th className="text-left py-2">Agent</th>
                <th className="text-left py-2">Status</th>
                <th className="text-right py-2">Uptime 24h</th>
                <th className="text-right py-2">Uptime 7d</th>
                <th className="text-right py-2">Latency</th>
                <th className="text-right py-2">Last Check</th>
              </tr>
            </thead>
            <tbody>
              {visibleInstances.map((i, idx) => (
                <tr
                  key={i.id}
                  className="border-b border-[var(--border-color)]/50 hover:bg-[var(--accent-dim)]/20 transition-colors"
                >
                  <td className="py-3">
                    <Link
                      href={`/dashboard/instances/${i.id}?tab=monitoring`}
                      className="text-[var(--text-primary)] hover:text-[var(--accent-color)]"
                    >
                      {i.name}
                    </Link>
                    <p className="text-[10px] font-mono text-[var(--text-secondary)]">{i.slug}</p>
                  </td>
                  <td className={`py-3 font-mono text-xs uppercase ${STATUS_STYLES[i.status] || ""}`}>
                    ● {i.status}
                  </td>
                  <td className="py-3 text-right font-mono text-xs">
                    {i.status === "running" ? `${(99.8 - idx * 0.1).toFixed(2)}%` : "—"}
                  </td>
                  <td className="py-3 text-right font-mono text-xs">
                    {i.status === "running" ? `${(99.6 - idx * 0.1).toFixed(2)}%` : "—"}
                  </td>
                  <td className="py-3 text-right font-mono text-xs">
                    {i.status === "running" ? `${140 + idx * 5} ms` : "—"}
                  </td>
                  <td className="py-3 text-right font-mono text-xs text-[var(--text-secondary)]">
                    {i.status === "running" ? `${10 + idx * 2}s ago` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-[10px] font-mono text-amber-400/80 mt-4">
          ⚠ uptime and latency values are placeholder — Uptime Kuma API integration pending
        </p>
      </div>

      <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-5">
        <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-[0.1em] font-mono mb-3">
          Kuma Integration
        </p>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          Health probes will run against each bot&apos;s gateway URL every 60 seconds.
          Uptime Kuma stores the raw history; this dashboard reads it through{" "}
          <code className="font-mono text-[var(--accent-color)] bg-[var(--code-bg)] px-1.5 py-0.5 border border-[var(--border-color)]">
            GET /api/monitoring/summary
          </code>{" "}
          (not yet implemented). Custom alerts, status pages, and SLA reports will follow.
        </p>
      </div>
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
      <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-[0.1em] font-mono">
        {label}
      </p>
      <p
        className={`text-3xl font-bold font-mono mt-2 ${
          accent ? "text-[var(--accent-color)]" : "text-[var(--text-primary)]"
        }`}
      >
        {value}
      </p>
    </div>
  )
}
