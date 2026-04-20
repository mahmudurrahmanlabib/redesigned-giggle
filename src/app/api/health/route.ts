import { NextResponse } from "next/server"
import { db, sql } from "@/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`)
    return NextResponse.json({ ok: true, db: "up" })
  } catch (err) {
    return NextResponse.json(
      { ok: false, db: "down", error: err instanceof Error ? err.message : String(err) },
      { status: 503 }
    )
  }
}
