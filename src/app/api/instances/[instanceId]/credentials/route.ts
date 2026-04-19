import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { decryptSecret } from "@/lib/crypto-secret"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { instanceId } = await params
  const instance = await prisma.instance.findUnique({ where: { id: instanceId } })
  if (!instance) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 })
  }
  const isAdmin = (session.user as { role?: string }).role === "admin"
  if (!isAdmin && instance.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!instance.openclawAdminEmail || !instance.openclawAdminPasswordEnc) {
    return NextResponse.json(
      { error: "Credentials not yet available. Provisioning may still be in progress." },
      { status: 409 }
    )
  }

  let password: string
  try {
    password = decryptSecret(instance.openclawAdminPasswordEnc)
  } catch {
    return NextResponse.json({ error: "Failed to decrypt credentials" }, { status: 500 })
  }

  return NextResponse.json({
    email: instance.openclawAdminEmail,
    password,
    loginUrl: instance.domain
      ? `https://${instance.domain}`
      : instance.ipAddress
      ? `http://${instance.ipAddress}`
      : null,
  })
}
