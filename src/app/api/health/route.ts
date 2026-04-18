import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Liveness + readiness probe consumed by docker-compose healthcheck and any
 * upstream load balancer. Returns 200 iff the app can reach Postgres.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, db: "up" })
  } catch (err) {
    return NextResponse.json(
      { ok: false, db: "down", error: err instanceof Error ? err.message : String(err) },
      { status: 503 }
    )
  }
}
