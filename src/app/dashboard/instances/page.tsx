import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

const STATUS_STYLES: Record<string, string> = {
  running: "bg-[var(--accent-dim)] text-[var(--accent-color)] border-[var(--accent-color)]/30",
  provisioning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  stopped: "bg-white/5 text-[var(--text-secondary)] border-[var(--border-color)]",
  failed: "bg-red-500/10 text-red-400 border-red-500/30",
  deleted: "bg-white/5 text-[var(--text-secondary)]/50 border-[var(--border-color)]",
}

export default async function InstancesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const instances = await prisma.instance.findMany({
    where: { userId: session.user.id },
    include: { region: true, serverConfig: true, logs: { take: 3, orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold uppercase tracking-[0.02em] text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Instances
          </h1>
          <p className="text-[var(--text-secondary)] mt-1 text-sm">All your OpenClaw deployments</p>
        </div>
        <Link href="/dashboard/deploy" className="btn-primary text-sm px-5 py-2.5">
          + Deploy New
        </Link>
      </div>

      {instances.length === 0 ? (
        <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-12 text-center">
          <p className="text-[var(--text-secondary)] mb-4">No instances yet.</p>
          <Link href="/dashboard/deploy" className="btn-primary inline-flex text-sm px-6 py-3">
            Deploy OpenClaw
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {instances.map((instance) => (
            <div key={instance.id} className="border border-[var(--border-color)] bg-[var(--card-bg)] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3
                      className="text-lg font-bold uppercase tracking-[0.02em] text-[var(--text-primary)]"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {instance.name}
                    </h3>
                    <Badge className={STATUS_STYLES[instance.status] || STATUS_STYLES.stopped}>
                      {instance.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1" style={{ fontFamily: "var(--font-mono)" }}>
                    {instance.slug}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {instance.status === "running" && (
                    <>
                      <button className="px-3 py-1.5 text-xs font-bold uppercase tracking-[0.05em] bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors" style={{ fontFamily: "var(--font-mono)" }}>
                        Restart
                      </button>
                      <button className="px-3 py-1.5 text-xs font-bold uppercase tracking-[0.05em] bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors" style={{ fontFamily: "var(--font-mono)" }}>
                        Stop
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
                {[
                  { label: "Region", value: `${instance.region.flag} ${instance.region.name}` },
                  { label: "Server", value: instance.serverConfig.label },
                  { label: "Specs", value: `${instance.serverConfig.vcpu} vCPU · ${instance.serverConfig.ramGb} GB` },
                  { label: "IP Address", value: instance.ipAddress || "Pending", mono: true },
                ].map((detail) => (
                  <div key={detail.label} className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3">
                    <p className="text-[var(--text-secondary)] text-xs uppercase tracking-[0.1em]" style={{ fontFamily: "var(--font-mono)" }}>
                      {detail.label}
                    </p>
                    <p className={`text-[var(--text-primary)] mt-0.5 text-sm ${detail.mono ? "font-mono text-xs" : ""}`}>
                      {detail.value}
                    </p>
                  </div>
                ))}
              </div>

              {instance.logs.length > 0 && (
                <div className="bg-[#050505] border border-[var(--border-color)] p-4 space-y-1.5">
                  <p className="text-[var(--text-secondary)] text-xs font-bold uppercase tracking-[0.1em] mb-2" style={{ fontFamily: "var(--font-mono)" }}>
                    Recent Logs
                  </p>
                  {instance.logs.map((log) => (
                    <p key={log.id} className="text-xs" style={{ fontFamily: "var(--font-mono)" }}>
                      <span className={`${log.level === "error" ? "text-red-400" : log.level === "warn" ? "text-amber-400" : "text-[var(--text-secondary)]"}`}>
                        [{log.level}]
                      </span>{" "}
                      <span className="text-[var(--text-secondary)]/60">{log.createdAt.toISOString().slice(0, 19)}</span>{" "}
                      <span className="text-[var(--text-primary)]">{log.message}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
