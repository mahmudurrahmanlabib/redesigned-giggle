import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [
    instances,
    activeSubs,
    user,
    usage30,
    incidents24,
  ] = await Promise.all([
    prisma.instance.findMany({
      where: { userId, status: { not: "deleted" } },
      select: { id: true, status: true },
    }),
    prisma.subscription.count({ where: { userId, status: "active" } }),
    prisma.user.findUnique({ where: { id: userId }, select: { credits: true } }),
    prisma.usageEvent.aggregate({
      where: { userId, createdAt: { gte: since30 } },
      _sum: { amount: true },
    }),
    prisma.instanceLog.count({
      where: {
        instance: { userId },
        level: "error",
        createdAt: { gte: since24 },
      },
    }),
  ])

  const activeInstances = instances.filter((i) => i.status === "running").length

  return NextResponse.json({
    activeInstances,
    totalInstances: instances.length,
    activeSubscriptions: activeSubs,
    credits: user?.credits ?? 0,
    usage30dTotal: usage30._sum.amount ?? 0,
    incidents24h: incidents24,
  })
}
