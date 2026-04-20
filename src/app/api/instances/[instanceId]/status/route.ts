import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db, instances, instanceLogs, eq, and, desc } from "@/db"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { instanceId } = await params

  const instance = await db.query.instances.findFirst({
    where: and(
      eq(instances.id, instanceId),
      eq(instances.userId, session.user.id)
    ),
    columns: {
      id: true,
      status: true,
      ipAddress: true,
      dnsStatus: true,
      tlsStatus: true,
    },
  })

  if (!instance) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const logs = await db.query.instanceLogs.findMany({
    where: eq(instanceLogs.instanceId, instanceId),
    orderBy: desc(instanceLogs.createdAt),
    limit: 20,
  })

  return NextResponse.json({
    status: instance.status,
    ipAddress: instance.ipAddress,
    dnsStatus: instance.dnsStatus,
    tlsStatus: instance.tlsStatus,
    logs: logs.map((l) => ({
      id: l.id,
      level: l.level,
      message: l.message,
      createdAt: l.createdAt.toISOString(),
    })),
  })
}
