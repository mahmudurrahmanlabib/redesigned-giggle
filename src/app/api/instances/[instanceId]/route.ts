import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db, instances, instanceLogs, subscriptions, eq } from "@/db"
import { deleteBot } from "@/lib/provisioner"
import { stripe, isStripeConfigured } from "@/lib/stripe"

/**
 * REST-friendly DELETE alias for /api/instances/:id. Mirrors the POST /delete
 * handler. The POST route remains for clients that prefer it; this one lets
 * fetch(..., { method: "DELETE" }) work.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { instanceId } = await params
  const isAdmin = (session.user as { role?: string }).role === "admin"

  const instance = await db.query.instances.findFirst({
    where: eq(instances.id, instanceId),
  })
  if (!instance) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 })
  }
  if (!isAdmin && instance.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    await deleteBot(instance)
  } catch (err) {
    console.error(`[instance DELETE] provisioner cleanup failed for ${instanceId}:`, err)
  }

  await db.insert(instanceLogs).values({
    instanceId,
    level: "warn",
    message: `Instance deleted by ${isAdmin ? "admin" : "user"}.`,
  })

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.instanceId, instanceId),
  })
  if (sub) {
    if (isStripeConfigured() && sub.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(sub.stripeSubscriptionId)
      } catch (err) {
        console.warn(`[instance DELETE] stripe cancel failed:`, err)
      }
    }
    await db
      .update(subscriptions)
      .set({ status: "canceled" })
      .where(eq(subscriptions.id, sub.id))
  }

  return NextResponse.json({ success: true })
}
