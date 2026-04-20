import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db, instances, subscriptions, eq } from "@/db"
import { deleteBot } from "@/lib/provisioner"
import { IllegalTransitionError } from "@/lib/instance-state"
import { stripe, isStripeConfigured } from "@/lib/stripe"

/**
 * REST-friendly DELETE alias for /api/instances/:id. Mirrors the POST /delete
 * handler — both surface errors and return 202 when retries are exhausted.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> },
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

  let result
  try {
    result = await deleteBot(instance)
  } catch (err) {
    if (err instanceof IllegalTransitionError) {
      return NextResponse.json({ status: "already_deleting" }, { status: 200 })
    }
    console.error(`[instance DELETE] deleteBot failed for ${instanceId}:`, err)
    return NextResponse.json(
      { error: "Delete failed", detail: (err as Error).message },
      { status: 500 },
    )
  }

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

  return NextResponse.json(result, {
    status: result.status === "deleted" ? 200 : 202,
  })
}
