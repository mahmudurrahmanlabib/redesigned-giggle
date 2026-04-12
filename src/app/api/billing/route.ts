import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const subscriptions = await prisma.subscription.findMany({
    where: { userId: session.user.id },
    include: {
      plan: true,
      instance: {
        include: { serverConfig: true, region: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(subscriptions)
}
