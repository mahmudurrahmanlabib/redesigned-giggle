import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db, eq, desc, subscriptions } from "@/db"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id as string

    const rows = await db.query.subscriptions.findMany({
      where: eq(subscriptions.userId, userId),
      with: {
        plan: true,
        instance: { with: { serverConfig: true, region: true } },
      },
      orderBy: desc(subscriptions.createdAt),
    })

    return NextResponse.json(rows)
  } catch (error) {
    console.error("Failed to fetch subscriptions:", error)
    return NextResponse.json(
      { error: "Failed to fetch subscriptions" },
      { status: 500 }
    )
  }
}
