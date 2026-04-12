import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { stripe, isStripeConfigured } from "@/lib/stripe"
import { createSlug, encryptRootPassword, generateMockIp, computeSshFingerprint, isValidPublicKey } from "@/lib/instance"
import { calcInstancePrice } from "@/lib/pricing"
import { BRANDING } from "@/configs/branding"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const {
    name,
    regionSlug,
    serverConfigSlug,
    billingInterval = "month",
    extraStorageGb = 0,
    rootPassword,
    sshPublicKey,
  } = body as {
    name: string
    regionSlug: string
    serverConfigSlug: string
    billingInterval?: "month" | "year"
    extraStorageGb?: number
    rootPassword?: string
    sshPublicKey?: string
  }

  if (!name || !regionSlug || !serverConfigSlug) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const [region, serverConfig] = await Promise.all([
    prisma.region.findUnique({ where: { slug: regionSlug } }),
    prisma.serverConfig.findUnique({ where: { slug: serverConfigSlug } }),
  ])

  if (!region || !region.available) {
    return NextResponse.json({ error: "Invalid or unavailable region" }, { status: 400 })
  }
  if (!serverConfig || !serverConfig.isActive) {
    return NextResponse.json({ error: "Invalid or inactive server config" }, { status: 400 })
  }

  let sshKeyId: string | undefined
  if (sshPublicKey) {
    if (!isValidPublicKey(sshPublicKey)) {
      return NextResponse.json({ error: "Invalid SSH public key" }, { status: 400 })
    }
    const fp = computeSshFingerprint(sshPublicKey)
    const existing = await prisma.sshKey.findFirst({
      where: { userId: session.user.id, fingerprint: fp },
    })
    if (existing) {
      sshKeyId = existing.id
    } else {
      const created = await prisma.sshKey.create({
        data: {
          userId: session.user.id,
          name: `key-${fp.slice(7, 19)}`,
          publicKey: sshPublicKey.trim(),
          fingerprint: fp,
        },
      })
      sshKeyId = created.id
    }
  }

  const instance = await prisma.instance.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      slug: createSlug(name),
      regionId: region.id,
      serverConfigId: serverConfig.id,
      sshKeyId,
      storageGb: serverConfig.storageGb + extraStorageGb,
      billingInterval,
      status: "provisioning",
      rootPasswordEnc: rootPassword ? encryptRootPassword(rootPassword) : undefined,
    },
  })

  await prisma.instanceLog.create({
    data: {
      instanceId: instance.id,
      level: "info",
      message: `Instance created. Server: ${serverConfig.label}, Region: ${region.name}. Awaiting payment.`,
    },
  })

  if (isStripeConfigured()) {
    const plan = await prisma.plan.findFirst({ where: { tier: "starter", isActive: true } })

    let stripeCustomerId = (await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true },
    }))?.stripeCustomerId

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: session.user.email ?? undefined,
        metadata: { userId: session.user.id },
      })
      stripeCustomerId = customer.id
      await prisma.user.update({
        where: { id: session.user.id },
        data: { stripeCustomerId },
      })
    }

    const price = calcInstancePrice({
      serverConfig,
      storageGb: extraStorageGb,
      interval: billingInterval,
    })

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${BRANDING.name} — ${serverConfig.label} (${region.name})`,
              description: `${serverConfig.vcpu} vCPU, ${serverConfig.ramGb} GB RAM, ${serverConfig.storageGb + extraStorageGb} GB storage`,
            },
            unit_amount: Math.round(
              (billingInterval === "year" ? price.total / 12 : price.total) * 100
            ),
            recurring: {
              interval: billingInterval === "year" ? "year" : "month",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        instanceId: instance.id,
        userId: session.user.id,
        planSlug: plan?.slug ?? "starter",
        interval: billingInterval,
      },
      success_url: `${BRANDING.appUrl}/dashboard/instances?deployed=${instance.id}`,
      cancel_url: `${BRANDING.appUrl}/dashboard/deploy`,
    })

    return NextResponse.json({
      instanceId: instance.id,
      checkoutUrl: checkoutSession.url,
    })
  }

  // Dev mode: skip Stripe, auto-activate
  await prisma.instance.update({
    where: { id: instance.id },
    data: {
      status: "running",
      ipAddress: generateMockIp(),
    },
  })

  const plan = await prisma.plan.findFirst({ where: { tier: "starter", isActive: true } })
  if (plan) {
    await prisma.subscription.create({
      data: {
        userId: session.user.id,
        planId: plan.id,
        instanceId: instance.id,
        interval: billingInterval,
        status: "active",
      },
    })
  }

  await prisma.instanceLog.create({
    data: {
      instanceId: instance.id,
      level: "info",
      message: "Dev mode: instance auto-activated (Stripe not configured).",
    },
  })

  return NextResponse.json({ instanceId: instance.id })
}
