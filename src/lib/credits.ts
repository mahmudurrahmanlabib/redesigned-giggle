import { prisma } from "@/lib/prisma"

export type ConsumeResult =
  | { ok: true; balance: number }
  | { ok: false; balance: number }

/**
 * Grant credits to a user. Writes a CreditLedger row and increments
 * User.credits atomically. Used by the Stripe invoice.paid handler for
 * subscription renewals and by one-time top-up checkouts.
 */
export async function grantCredits(
  userId: string,
  amount: number,
  reason: string
): Promise<number> {
  if (amount <= 0) {
    throw new Error(`grantCredits requires a positive amount, got ${amount}`)
  }
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { credits: { increment: amount } },
      select: { credits: true },
    })
    await tx.creditLedger.create({
      data: {
        userId,
        delta: amount,
        reason,
        balance: user.credits,
      },
    })
    return user.credits
  })
}

/**
 * Consume credits. Returns { ok: false, balance } instead of throwing if the
 * user's balance would drop below zero so callers (like /api/usage/ingest)
 * can pause the bot without swallowing exceptions.
 */
export async function consumeCredits(
  userId: string,
  amount: number,
  reason: string
): Promise<ConsumeResult> {
  if (amount <= 0) {
    throw new Error(`consumeCredits requires a positive amount, got ${amount}`)
  }
  return prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    })
    if (!current) {
      throw new Error(`consumeCredits: user ${userId} not found`)
    }
    if (current.credits < amount) {
      return { ok: false as const, balance: current.credits }
    }
    const updated = await tx.user.update({
      where: { id: userId },
      data: { credits: { decrement: amount } },
      select: { credits: true },
    })
    await tx.creditLedger.create({
      data: {
        userId,
        delta: -amount,
        reason,
        balance: updated.credits,
      },
    })
    return { ok: true as const, balance: updated.credits }
  })
}

/** Read the current credit balance for a user. */
export async function getBalance(userId: string): Promise<number> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  })
  return row?.credits ?? 0
}
