import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const [totalUsers, activeInstances, totalInstances, activeSubscriptions, bannedUsers] =
    await Promise.all([
      prisma.user.count({ where: { role: "user" } }),
      prisma.instance.count({ where: { status: "running" } }),
      prisma.instance.count(),
      prisma.subscription.count({ where: { status: "active" } }),
      prisma.user.count({ where: { isBanned: true } }),
    ])

  return NextResponse.json({
    totalUsers,
    activeInstances,
    totalInstances,
    activeSubscriptions,
    bannedUsers,
  })
}
