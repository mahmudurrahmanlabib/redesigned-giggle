import { NextRequest, NextResponse } from "next/server"
import dns from "node:dns"
import { auth } from "@/auth"
import { db, instances, eq } from "@/db"

type DnsStatus = "pending" | "propagating" | "ready" | "error"
type TlsStatus = "pending" | "issued" | "failed"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { instanceId } = await params
  const instance = await db.query.instances.findFirst({
    where: eq(instances.id, instanceId),
  })
  if (!instance) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 })
  }
  const isAdmin = (session.user as { role?: string }).role === "admin"
  if (!isAdmin && instance.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // No domain configured = no DNS/TLS state. Do NOT synthesize "ready"/"issued"
  // here — those columns stay NULL until the user opts in with a real domain.
  if (!instance.domain) {
    return NextResponse.json({
      domain: null,
      dnsStatus: null,
      tlsStatus: null,
      resolvedIps: [],
      expectedIp: instance.ipAddress,
    })
  }

  let resolvedIps: string[] = []
  let dnsStatus: DnsStatus = (instance.dnsStatus as DnsStatus) ?? "pending"
  try {
    resolvedIps = await dns.promises.resolve4(instance.domain)
    if (instance.ipAddress && resolvedIps.includes(instance.ipAddress)) {
      dnsStatus = "ready"
    } else if (resolvedIps.length > 0) {
      dnsStatus = "propagating"
    }
  } catch {
    // NXDOMAIN / NOTFOUND — still pending.
    dnsStatus = "pending"
  }

  let tlsStatus: TlsStatus = (instance.tlsStatus as TlsStatus) ?? "pending"
  if (dnsStatus === "ready") {
    try {
      const probe = await fetch(`https://${instance.domain}/`, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
      })
      if (probe.status < 500) tlsStatus = "issued"
    } catch {
      // Cert may not yet be issued — leave as-is.
    }
  }

  if (dnsStatus !== instance.dnsStatus || tlsStatus !== instance.tlsStatus) {
    await db
      .update(instances)
      .set({ dnsStatus, tlsStatus })
      .where(eq(instances.id, instance.id))
  }

  return NextResponse.json({
    domain: instance.domain,
    dnsStatus,
    tlsStatus,
    resolvedIps,
    expectedIp: instance.ipAddress,
  })
}
