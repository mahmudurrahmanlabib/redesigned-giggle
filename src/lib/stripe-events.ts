// Webhook event handlers for Stripe.
// Each handler is called by /api/webhooks/stripe with the typed event payload.
// The webhook is the SINGLE SOURCE OF TRUTH for Instance status transitions.

import type Stripe from "stripe"
import { prisma } from "@/lib/prisma"
import { provisionBot } from "@/lib/provisioner"
import { grantCredits } from "@/lib/credits"

// ---------- checkout.session.completed ----------
// Triggered when the user finishes paying. Flips Instance to "running",
// creates the Subscription row, writes a log entry.

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const metadata = (session.metadata ?? {}) as {
    instanceId?: string
    userId?: string
    planSlug?: string
    interval?: "month" | "year"
  }

  const instanceId = metadata.instanceId
  if (!instanceId) {
    console.warn("[stripe] checkout.session.completed missing instanceId in metadata")
    return
  }

  const instance = await prisma.instance.findUnique({ where: { id: instanceId } })
  if (!instance) {
    console.warn(`[stripe] Instance ${instanceId} not found`)
    return
  }

  const plan = metadata.planSlug
    ? await prisma.plan.findUnique({ where: { slug: metadata.planSlug } })
    : await prisma.plan.findFirst({ where: { tier: "starter" } })

  if (!plan) {
    console.warn("[stripe] No plan found for checkout session")
    return
  }

  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null

  // Stamp the subscription id first so downstream provisioning has a record.
  await prisma.instance.update({
    where: { id: instanceId },
    data: {
      stripeSubscriptionId: stripeSubscriptionId ?? undefined,
    },
  })

  // Real provision. In mock mode (no LINODE_API_TOKEN) this falls back to
  // assigning a mock IP and flipping status=running, preserving dev behavior.
  try {
    const fresh = await prisma.instance.findUnique({ where: { id: instanceId } })
    if (fresh) {
      await provisionBot(fresh)
    }
  } catch (err) {
    console.error(`[stripe] provisionBot failed for ${instanceId}:`, err)
    await prisma.instance.update({
      where: { id: instanceId },
      data: { status: "failed" },
    })
    await prisma.instanceLog.create({
      data: {
        instanceId,
        level: "error",
        message: `Provisioning failed after payment: ${err instanceof Error ? err.message : String(err)}`,
      },
    })
  }

  // Create the Subscription row, linked 1:1 to the instance.
  await prisma.subscription.upsert({
    where: { instanceId },
    update: {
      stripeSubscriptionId: stripeSubscriptionId ?? undefined,
      status: "active",
      interval: metadata.interval ?? "month",
    },
    create: {
      userId: instance.userId,
      planId: plan.id,
      instanceId,
      stripeSubscriptionId: stripeSubscriptionId ?? undefined,
      interval: metadata.interval ?? "month",
      status: "active",
    },
  })

  await prisma.instanceLog.create({
    data: {
      instanceId,
      level: "info",
      message: "Deployment provisioned via Stripe checkout. Status: running.",
    },
  })
}

// ---------- customer.subscription.updated ----------

export async function handleSubscriptionUpdated(
  sub: Stripe.Subscription
): Promise<void> {
  const local = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: sub.id },
  })
  if (!local) return
  await prisma.subscription.update({
    where: { id: local.id },
    data: {
      status: sub.status,
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
  })
}

// ---------- customer.subscription.deleted ----------

export async function handleSubscriptionDeleted(
  sub: Stripe.Subscription
): Promise<void> {
  const local = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: sub.id },
    include: { instance: true },
  })
  if (!local) return
  await prisma.subscription.update({
    where: { id: local.id },
    data: { status: "canceled" },
  })
  if (local.instance) {
    await prisma.instance.update({
      where: { id: local.instance.id },
      data: { status: "stopped" },
    })
    await prisma.instanceLog.create({
      data: {
        instanceId: local.instance.id,
        level: "warn",
        message: "Subscription canceled. Instance stopped.",
      },
    })
  }
}

// ---------- invoice.paid ----------

export async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const subId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id
  if (!subId) return
  const local = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subId },
    include: { plan: true },
  })
  if (!local) return
  await prisma.subscription.update({
    where: { id: local.id },
    data: { status: "active" },
  })

  // Grant monthly credits for the renewal period.
  const credits = local.plan?.creditsPerPeriod ?? 0
  if (credits > 0) {
    const periodLabel = new Date().toISOString().slice(0, 7) // yyyy-mm
    try {
      await grantCredits(
        local.userId,
        credits,
        `subscription:${local.plan?.slug ?? "unknown"}:${periodLabel}:${invoice.id ?? "no-invoice"}`
      )
    } catch (err) {
      console.error(`[stripe] grantCredits failed for user ${local.userId}:`, err)
    }
  }
}

// ---------- invoice.payment_failed ----------

export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  const subId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id
  if (!subId) return
  const local = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subId },
    include: { instance: true },
  })
  if (!local) return
  await prisma.subscription.update({
    where: { id: local.id },
    data: { status: "past_due" },
  })
  if (local.instance) {
    await prisma.instanceLog.create({
      data: {
        instanceId: local.instance.id,
        level: "error",
        message: "Payment failed. Subscription marked past_due.",
      },
    })
  }
}
