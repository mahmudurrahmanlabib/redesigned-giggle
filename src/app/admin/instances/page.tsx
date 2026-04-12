import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"

const STATUS_STYLES: Record<string, string> = {
  running: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  provisioning: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  stopped: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  deleted: "bg-zinc-800/20 text-zinc-600 border-zinc-800/30",
}

export default async function AdminInstancesPage() {
  const instances = await prisma.instance.findMany({
    include: { user: true, region: true, serverConfig: true },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-white">All Instances</h1>
        <p className="text-zinc-400 mt-1">Manage all deployed OpenClaw instances across users.</p>
      </div>

      {instances.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
          <p className="text-zinc-400">No instances deployed yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {instances.map((instance) => (
            <div
              key={instance.id}
              className="bg-white/5 border border-white/10 rounded-xl p-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-white font-medium">{instance.name}</h3>
                    <Badge className={STATUS_STYLES[instance.status] || STATUS_STYLES.stopped}>
                      {instance.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-400 mt-1">{instance.user.email}</p>
                  <p className="text-xs text-zinc-500 font-mono">{instance.slug} &middot; {instance.ipAddress || "no IP"}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-zinc-300">{instance.region.flag} {instance.region.name}</p>
                  <p className="text-zinc-500">{instance.serverConfig.label} &middot; {instance.serverConfig.vcpu} vCPU &middot; {instance.serverConfig.ramGb} GB</p>
                  <p className="text-zinc-600 text-xs mt-1">{instance.createdAt.toISOString().slice(0, 10)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
