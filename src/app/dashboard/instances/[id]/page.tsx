import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { InstanceTabs } from "./instance-tabs"

const STATUS_STYLES: Record<string, string> = {
  running: "bg-[var(--accent-dim)] text-[var(--accent-color)] border-[var(--accent-color)]/30",
  provisioning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  stopped: "bg-[var(--card-bg)] text-[var(--text-secondary)] border-[var(--border-color)]",
  failed: "bg-red-500/10 text-red-400 border-red-500/30",
  deleted: "bg-[var(--card-bg)] text-[var(--text-secondary)]/50 border-[var(--border-color)]",
}

export default async function InstanceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params
  const { tab } = await searchParams

  const instance = await prisma.instance.findFirst({
    where: { id, userId: session.user.id },
    include: {
      region: true,
      serverConfig: true,
      logs: { take: 20, orderBy: { createdAt: "desc" } },
    },
  })

  if (!instance) notFound()

  const gatewayBase = process.env.NEXT_PUBLIC_GATEWAY_DOMAIN || "gateway.sovereignml.ai"
  const gatewayUrl = `https://${gatewayBase}/${instance.id.slice(0, 8)}`
  const accessUrl = instance.ipAddress
    ? `https://${instance.ipAddress}`
    : gatewayUrl

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/dashboard/instances"
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent-color)] font-mono"
          >
            ← Back to agents
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <h1
              className="text-3xl font-bold uppercase tracking-[0.02em] text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {instance.name}
            </h1>
            <Badge className={STATUS_STYLES[instance.status] || STATUS_STYLES.stopped}>
              {instance.status}
            </Badge>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1 font-mono">
            {instance.slug} · id:{instance.id}
          </p>
        </div>
      </div>

      {/* Access block — always visible at the top */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-[var(--accent-color)]/30 bg-[var(--accent-dim)]/20 p-4">
          <p className="text-[10px] text-[var(--accent-color)] uppercase tracking-[0.1em] font-mono mb-2">
            Gateway URL
          </p>
          <a
            href={gatewayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm text-[var(--text-primary)] hover:text-[var(--accent-color)] break-all"
          >
            {gatewayUrl}
          </a>
          <p className="text-xs text-[var(--text-secondary)] mt-2">
            Public endpoint. Routes to this bot through the managed gateway.
          </p>
        </div>
        <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
          <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-[0.1em] font-mono mb-2">
            Instance Access
          </p>
          <p className="font-mono text-sm text-[var(--text-primary)] break-all">
            {accessUrl}
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-2">
            {instance.ipAddress
              ? `Direct VPS access at ${instance.ipAddress}`
              : "Serverless — no direct VPS access. Use gateway URL."}
          </p>
        </div>
      </div>

      <InstanceTabs
        active={tab || "overview"}
        instance={{
          id: instance.id,
          name: instance.name,
          status: instance.status,
          ipAddress: instance.ipAddress,
          regionLabel: `${instance.region.flag} ${instance.region.name}`,
          serverLabel: instance.serverConfig.label,
          vcpu: instance.serverConfig.vcpu,
          ramGb: instance.serverConfig.ramGb,
          createdAt: instance.createdAt.toISOString(),
          gatewayUrl,
          domain: instance.domain,
          dnsStatus: instance.dnsStatus,
          tlsStatus: instance.tlsStatus,
          openclawAdminEmail: instance.openclawAdminEmail,
          hasOpenclawPassword: Boolean(instance.openclawAdminPasswordEnc),
        }}
        logs={instance.logs.map((l) => ({
          id: l.id,
          level: l.level,
          message: l.message,
          createdAt: l.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
