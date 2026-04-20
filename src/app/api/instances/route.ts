import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db, instances, eq, desc } from "@/db"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const isAdmin = (session.user as { role?: string }).role === "admin"

  const rows = await db.query.instances.findMany({
    where: isAdmin ? undefined : eq(instances.userId, session.user.id),
    with: {
      region: true,
      serverConfig: true,
      logs: {
        orderBy: (logs, { desc: d }) => d(logs.createdAt),
        limit: 5,
      },
    },
    orderBy: desc(instances.createdAt),
  })

  return NextResponse.json(rows)
}
