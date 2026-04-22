import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db, desc, instances } from "@/db"
import { whereUserInstancesVisible } from "@/lib/instance-queries"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rows = await db.query.instances.findMany({
    where: whereUserInstancesVisible(session.user.id),
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
