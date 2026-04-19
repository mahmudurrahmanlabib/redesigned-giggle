import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { reprovisionBotEnv } from "@/lib/provisioner"

async function requireOwner(instanceId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  const isAdmin = (session.user as { role?: string }).role === "admin"
  const instance = await prisma.instance.findUnique({ where: { id: instanceId } })
  if (!instance) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) }
  }
  if (!isAdmin && instance.userId !== session.user.id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { instance }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  const { instanceId } = await params
  const check = await requireOwner(instanceId)
  if ("error" in check) return check.error
  return NextResponse.json({ botToken: check.instance.botToken })
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  const { instanceId } = await params
  const check = await requireOwner(instanceId)
  if ("error" in check) return check.error

  const newToken = "sk_bot_" + crypto.randomBytes(24).toString("hex")
  const updated = await prisma.instance.update({
    where: { id: instanceId },
    data: { botToken: newToken },
  })

  // Push new env to the running container so the new token takes effect.
  try {
    await reprovisionBotEnv(updated)
  } catch (err) {
    console.warn(`[token] reprovision after rotate failed for ${instanceId}:`, err)
  }

  await prisma.instanceLog.create({
    data: { instanceId, level: "info", message: "Bot token rotated." },
  })

  return NextResponse.json({ botToken: newToken })
}
