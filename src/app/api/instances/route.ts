import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const isAdmin = (session.user as { role?: string }).role === "admin"

  const instances = await prisma.instance.findMany({
    where: isAdmin ? {} : { userId: session.user.id },
    include: {
      region: true,
      serverConfig: true,
      logs: { take: 5, orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(instances)
}
