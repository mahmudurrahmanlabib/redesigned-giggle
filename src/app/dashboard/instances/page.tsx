import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { InstancesFilter } from "./instances-filter"

export default async function InstancesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const instances = await prisma.instance.findMany({
    where: { userId: session.user.id },
    include: { region: true, serverConfig: true, logs: { take: 3, orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  })

  const items = instances.map((i) => ({
    id: i.id,
    name: i.name,
    slug: i.slug,
    status: i.status,
    ipAddress: i.ipAddress,
    regionLabel: `${i.region.flag} ${i.region.name}`,
    serverLabel: i.serverConfig.label,
    vcpu: i.serverConfig.vcpu,
    ramGb: i.serverConfig.ramGb,
    recentLogs: i.logs.map((l) => ({
      id: l.id,
      level: l.level,
      message: l.message,
      createdAt: l.createdAt.toISOString(),
    })),
  }))

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold uppercase tracking-[0.02em] text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Instances
          </h1>
          <p className="text-[var(--text-secondary)] mt-1 text-sm">All your deployed AI agents</p>
        </div>
        <Link href="/dashboard/deploy" className="btn-primary text-sm px-5 py-2.5">
          + Deploy New
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-12 text-center">
          <p className="text-[var(--text-secondary)] mb-4">No instances yet.</p>
          <Link href="/dashboard/deploy" className="btn-primary inline-flex text-sm px-6 py-3">
            Deploy Agent
          </Link>
        </div>
      ) : (
        <InstancesFilter items={items} />
      )}
    </div>
  )
}
