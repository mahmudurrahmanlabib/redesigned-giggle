import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db, eq, desc, subscriptions } from "@/db"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rows = await db.query.subscriptions.findMany({
    where: eq(subscriptions.userId, session.user.id),
    with: {
      plan: true,
      instance: {
        with: { serverConfig: true, region: true },
      },
    },
    orderBy: desc(subscriptions.createdAt),
  })

  return NextResponse.json(rows)
}
