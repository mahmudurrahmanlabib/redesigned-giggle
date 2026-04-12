import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { instanceId } = await params
  const isAdmin = (session.user as { role?: string }).role === "admin"

  const instance = await prisma.instance.findUnique({
    where: { id: instanceId },
  })

  if (!instance) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 })
  }
  if (!isAdmin && instance.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (instance.status !== "running" && instance.status !== "stopped") {
    return NextResponse.json(
      { error: `Cannot restart instance in ${instance.status} state` },
      { status: 400 }
    )
  }

  // TODO: integrate actual restart via Hetzner/provisioner API
  await prisma.instance.update({
    where: { id: instanceId },
    data: { status: "running" },
  })

  await prisma.instanceLog.create({
    data: {
      instanceId,
      level: "info",
      message: `Instance restarted by ${isAdmin ? "admin" : "user"}.`,
    },
  })

  return NextResponse.json({ success: true })
}
