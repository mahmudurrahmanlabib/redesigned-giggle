import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"
import { auth } from "@/auth"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { stripe, isStripeConfigured } from "@/lib/stripe"
import { createSlug, encryptRootPassword, computeSshFingerprint, isValidPublicKey } from "@/lib/instance"
import { calcInstancePrice } from "@/lib/pricing"
import { BRANDING } from "@/configs/branding"
import { parseAgentConfig } from "@/lib/agent-config"
import { selectSkills } from "@/configs/skill-map"
import { generateSoul } from "@/lib/soul"
import { routeModel } from "@/lib/model-router"
import { provisionBot } from "@/lib/provisioner"

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
    agentConfig: agentConfigInput,
    domain,
  } = body as {
    name: string
    regionSlug: string
    serverConfigSlug: string
    billingInterval?: "month" | "year"
    extraStorageGb?: number
    rootPassword?: string
    sshPublicKey?: string
    agentConfig?: unknown
    domain?: string
  }

  let normalizedDomain: string | null = null
  if (typeof domain === "string" && domain.trim().length > 0) {
    const trimmed = domain.trim().toLowerCase()
    // Minimal FQDN check: 2+ labels, alnum/dash, no trailing dot required.
    if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(trimmed)) {
      return NextResponse.json({ error: "Invalid domain" }, { status: 400 })
    }
    normalizedDomain = trimmed
  }

  if (!name || !regionSlug || !serverConfigSlug) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  // agentConfig is optional today so legacy deploys keep working; when present
  // it must validate.
  let parsedAgentConfig: ReturnType<typeof parseAgentConfig> | null = null
  if (agentConfigInput) {
    parsedAgentConfig = parseAgentConfig(agentConfigInput)
    if (!parsedAgentConfig.ok) {
      return NextResponse.json({ error: `Invalid agentConfig: ${parsedAgentConfig.error}` }, { status: 400 })
    }
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

  // Derive agent-factory fields when agentConfig was supplied.
  let agentFields: {
    agentType: string | null
    agentConfig: Prisma.InputJsonValue | typeof Prisma.JsonNull
    soulMd: string | null
    skills: Prisma.InputJsonValue | typeof Prisma.JsonNull
    modelTier: string | null
    botToken: string | null
    deploymentTarget: string | null
    interfaceKind: string | null
  } = {
    agentType: null,
    agentConfig: Prisma.JsonNull,
    soulMd: null,
    skills: Prisma.JsonNull,
    modelTier: null,
    botToken: null,
    deploymentTarget: null,
    interfaceKind: null,
  }
  if (parsedAgentConfig?.ok) {
    const cfg = parsedAgentConfig.data
    const skills = selectSkills(cfg)
    const soulMd = generateSoul(cfg, skills)
    // Sanity check model routing early so we fail fast instead of during provision.
    routeModel(cfg.budget_tier)
    const botToken = "sk_bot_" + crypto.randomBytes(24).toString("hex")
    agentFields = {
      agentType: cfg.use_case,
      agentConfig: cfg as unknown as Prisma.InputJsonValue,
      soulMd,
      skills,
      modelTier: cfg.budget_tier,
      botToken,
      deploymentTarget: cfg.deployment_target,
      interfaceKind: cfg.interface,
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
      domain: normalizedDomain,
      ...agentFields,
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

  // Dev mode: skip Stripe, auto-activate. Provision now so the bot is usable.
  try {
    const freshInstance = await prisma.instance.findUnique({ where: { id: instance.id } })
    if (freshInstance) {
      await provisionBot(freshInstance)
    }
  } catch (err) {
    console.error("[deploy] provisionBot failed (dev path):", err)
    await prisma.instance.update({
      where: { id: instance.id },
      data: { status: "failed" },
    })
    await prisma.instanceLog.create({
      data: {
        instanceId: instance.id,
        level: "error",
        message: `Provisioning failed: ${err instanceof Error ? err.message : String(err)}`,
      },
    })
  }

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
