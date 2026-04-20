import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db, instances, instanceLogs, subscriptions, eq } from "@/db"
import { deleteBot } from "@/lib/provisioner"
import { stripe, isStripeConfigured } from "@/lib/stripe"

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
    console.error(`[delete] provisioner cleanup failed for ${instanceId}:`, err)
    // Non-fatal — we still want the DB record to reflect deletion.
  }

  await db.insert(instanceLogs).values({
    instanceId,
    level: "warn",
    message: `Instance deleted by ${isAdmin ? "admin" : "user"}.`,
  })

  // Cancel linked subscription if exists
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.instanceId, instanceId),
  })
  if (sub) {
    if (isStripeConfigured() && sub.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(sub.stripeSubscriptionId)
      } catch (err) {
        console.warn(`[delete] stripe cancel failed:`, err)
      }
    }
    await db
      .update(subscriptions)
      .set({ status: "canceled" })
      .where(eq(subscriptions.id, sub.id))
  }

  return NextResponse.json({ success: true })
}
