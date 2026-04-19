import { prisma } from "@/lib/prisma"

export class FleetFullError extends Error {
  constructor() {
    super("All bot hosts are at capacity. Add a new host via `pnpm bootstrap:host`.")
    this.name = "FleetFullError"
  }
}

export class FleetEmptyError extends Error {
  constructor() {
    super("No ready BotHost rows exist. Run `pnpm bootstrap:host` to provision one.")
    this.name = "FleetEmptyError"
  }
}

export type PickedHost = {
  id: string
  ipAddress: string
  capacity: number
  runningCount: number
}

/**
 * Pick the least-loaded "ready" BotHost. Load = count of Instances that are
 * still bound to the host (status != deleted). Throws FleetEmptyError if no
 * hosts exist at all, FleetFullError if every host is at capacity.
 */
export async function pickHost(): Promise<PickedHost> {
  const hosts = await prisma.botHost.findMany({
    where: { status: "ready" },
    include: { _count: { select: { instances: true } } },
  })
  if (hosts.length === 0) {
    throw new FleetEmptyError()
  }

  const ranked = hosts
    .map((h) => ({
      id: h.id,
      ipAddress: h.ipAddress,
      capacity: h.capacity,
      runningCount: h._count.instances,
    }))
    .filter((h) => h.runningCount < h.capacity)
    .sort((a, b) => a.runningCount - b.runningCount)

  if (ranked.length === 0) {
    throw new FleetFullError()
  }
  return ranked[0]
}

/**
 * Allocate a free TCP port on the picked host in [4000, 5999]. Scans the
 * existing Instance.containerPort values on that host and picks the first
 * unused one.
 */
export async function allocatePort(botHostId: string): Promise<number> {
  const used = await prisma.instance.findMany({
    where: { botHostId, containerPort: { not: null } },
    select: { containerPort: true },
  })
  const taken = new Set(used.map((r) => r.containerPort).filter((p): p is number => typeof p === "number"))
  for (let port = 4000; port <= 5999; port++) {
    if (!taken.has(port)) return port
  }
  throw new Error(`No free port in 4000-5999 on host ${botHostId}`)
}
