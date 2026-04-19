import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { consumeCredits } from "@/lib/credits"
import { pauseBot } from "@/lib/provisioner"

/**
 * Bot runtimes POST usage events here. Each event decrements the owner's
 * credit balance. When a user runs out of credits we pause the bot.
 *
 * Auth: X-Bot-Token header must match Instance.botToken. This is a shared
 * secret baked into the container's env at provision time.
 *
 * Credit cost rules (v1 — tune as we learn):
 *   - request → 1 credit
 *   - tokens_in → 1 credit per 1000 tokens (rounded up, min 1)
 *   - tokens_out → 2 credits per 1000 tokens (rounded up, min 1)
 */

type IngestBody = {
  kind: "request" | "tokens_in" | "tokens_out"
  amount: number
  meta?: Record<string, unknown>
  instanceId?: string
}

function computeCreditCost(kind: IngestBody["kind"], amount: number): number {
  if (amount <= 0) return 0
  switch (kind) {
    case "request":
      return amount
    case "tokens_in":
      return Math.max(1, Math.ceil(amount / 1000))
    case "tokens_out":
      return Math.max(1, Math.ceil(amount / 1000) * 2)
  }
}

export async function POST(req: NextRequest) {
  const botToken = req.headers.get("x-bot-token")
  if (!botToken) {
    return NextResponse.json({ error: "missing x-bot-token" }, { status: 401 })
  }

  const instance = await prisma.instance.findUnique({ where: { botToken } })
  if (!instance) {
    return NextResponse.json({ error: "invalid bot token" }, { status: 401 })
  }

  let body: IngestBody
  try {
    body = (await req.json()) as IngestBody
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }
  if (!body.kind || typeof body.amount !== "number") {
    return NextResponse.json({ error: "kind and amount are required" }, { status: 400 })
  }

  // Persist the raw event.
  await prisma.usageEvent.create({
    data: {
      instanceId: instance.id,
      userId: instance.userId,
      kind: body.kind,
      amount: Math.round(body.amount),
      meta: (body.meta ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    },
  })

  // Touch lastActiveAt on request-kind events so the UI's "last active"
  // column stays useful even when only tokens events arrive.
  if (body.kind === "request") {
    await prisma.instance.update({
      where: { id: instance.id },
      data: { lastActiveAt: new Date() },
    })
  }

  const cost = computeCreditCost(body.kind, body.amount)
  if (cost <= 0) {
    return NextResponse.json({ ok: true, cost: 0, balance: null })
  }

  const result = await consumeCredits(instance.userId, cost, `consume:${instance.id}:${body.kind}`)
  if (!result.ok) {
    // Pause the bot to stop further spend.
    try {
      await pauseBot(instance)
    } catch (err) {
      console.warn(`[usage] pauseBot failed for ${instance.id}:`, err)
    }
    await prisma.instanceLog.create({
      data: {
        instanceId: instance.id,
        level: "warn",
        message: "Credits exhausted. Bot paused. Top up to resume.",
      },
    })
    return NextResponse.json(
      { ok: false, reason: "credits_exhausted", balance: result.balance },
      { status: 402 }
    )
  }

  return NextResponse.json({ ok: true, cost, balance: result.balance })
}
