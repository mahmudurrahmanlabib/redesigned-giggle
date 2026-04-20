import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"
import { auth } from "@/auth"
import { db, eq, and, asc, instances, instanceLogs, regions, serverConfigs, sshKeys, users, plans, subscriptions } from "@/db"
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
    regionSlug?: string
    serverConfigSlug?: string
    billingInterval?: "month" | "year"
    extraStorageGb?: number
    rootPassword?: string
    sshPublicKey?: string
    agentConfig?: unknown
    domain?: string
  }

  if (!name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  let normalizedDomain: string | null = null
  if (typeof domain === "string" && domain.trim().length > 0) {
    const trimmed = domain.trim().toLowerCase()
    if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(trimmed)) {
      return NextResponse.json({ error: "Invalid domain" }, { status: 400 })
    }
    normalizedDomain = trimmed
  }

  let parsedAgentConfig: ReturnType<typeof parseAgentConfig> | null = null
  if (agentConfigInput) {
    parsedAgentConfig = parseAgentConfig(agentConfigInput)
    if (!parsedAgentConfig.ok) {
      return NextResponse.json({ error: `Invalid agentConfig: ${parsedAgentConfig.error}` }, { status: 400 })
    }
  }

  const isVps = parsedAgentConfig?.ok
    ? parsedAgentConfig.data.deployment_target === "vps"
    : !!regionSlug

  let region, serverConfig

  if (regionSlug && serverConfigSlug) {
    ;[region, serverConfig] = await Promise.all([
      db.query.regions.findFirst({ where: eq(regions.slug, regionSlug) }),
      db.query.serverConfigs.findFirst({ where: eq(serverConfigs.slug, serverConfigSlug) }),
    ])
  }

  if (!region) {
    region = await db.query.regions.findFirst({
      where: eq(regions.available, true),
      orderBy: asc(regions.sortOrder),
    })
  }
  if (!serverConfig) {
    serverConfig = await db.query.serverConfigs.findFirst({
      where: eq(serverConfigs.isActive, true),
      orderBy: asc(serverConfigs.sortOrder),
    })
  }

  if (!region) {
    return NextResponse.json({ error: "No available region found" }, { status: 500 })
  }
  if (!serverConfig) {
    return NextResponse.json({ error: "No active server config found" }, { status: 500 })
  }
  if (isVps && !region.available) {
    return NextResponse.json({ error: "Invalid or unavailable region" }, { status: 400 })
  }

  let sshKeyId: string | undefined
  if (sshPublicKey) {
    if (!isValidPublicKey(sshPublicKey)) {
      return NextResponse.json({ error: "Invalid SSH public key" }, { status: 400 })
    }
    const fp = computeSshFingerprint(sshPublicKey)
    const existing = await db.query.sshKeys.findFirst({
      where: eq(sshKeys.fingerprint, fp),
    })
    if (existing) {
      sshKeyId = existing.id
    } else {
      const [created] = await db
        .insert(sshKeys)
        .values({
          userId: session.user.id,
          name: `key-${fp.slice(7, 19)}`,
          publicKey: sshPublicKey.trim(),
          fingerprint: fp,
        })
        .returning()
      sshKeyId = created.id
    }
  }

  let agentFields: {
    agentType: string | null
    agentConfig: unknown
    soulMd: string | null
    skills: unknown
    modelTier: string | null
    botToken: string | null
    deploymentTarget: string | null
    interfaceKind: string | null
  } = {
    agentType: null,
    agentConfig: null,
    soulMd: null,
    skills: null,
    modelTier: null,
    botToken: null,
    deploymentTarget: null,
    interfaceKind: null,
  }
  if (parsedAgentConfig?.ok) {
    const cfg = parsedAgentConfig.data
    const skills = selectSkills(cfg)
    const soulMd = generateSoul(cfg, skills)
    routeModel(cfg.budget_tier)
    const botToken = "sk_bot_" + crypto.randomBytes(24).toString("hex")
    agentFields = {
      agentType: cfg.use_case,
      agentConfig: cfg,
      soulMd,
      skills,
      modelTier: cfg.budget_tier,
      botToken,
      deploymentTarget: cfg.deployment_target,
      interfaceKind: cfg.interface,
    }
  }

  const [instance] = await db
    .insert(instances)
    .values({
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
    })
    .returning()

  await db.insert(instanceLogs).values({
    instanceId: instance.id,
    level: "info",
    message: `Instance created. Server: ${serverConfig.label}, Region: ${region.name}. Awaiting payment.`,
  })

  if (isStripeConfigured()) {
    const plan = await db.query.plans.findFirst({
      where: and(eq(plans.tier, "starter"), eq(plans.isActive, true)),
    })

    const userRow = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { stripeCustomerId: true },
    })
    let stripeCustomerId = userRow?.stripeCustomerId

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: session.user.email ?? undefined,
        metadata: { userId: session.user.id },
      })
      stripeCustomerId = customer.id
      await db
        .update(users)
        .set({ stripeCustomerId })
        .where(eq(users.id, session.user.id))
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

  // Dev mode: skip Stripe, auto-activate.
  try {
    const freshInstance = await db.query.instances.findFirst({
      where: eq(instances.id, instance.id),
    })
    if (freshInstance) {
      await provisionBot(freshInstance)
    }
  } catch (err) {
    console.error("[deploy] provisionBot failed (dev path):", err)
    await db
      .update(instances)
      .set({ status: "failed" })
      .where(eq(instances.id, instance.id))
    await db.insert(instanceLogs).values({
      instanceId: instance.id,
      level: "error",
      message: `Provisioning failed: ${err instanceof Error ? err.message : String(err)}`,
    })
  }

  const plan = await db.query.plans.findFirst({
    where: and(eq(plans.tier, "starter"), eq(plans.isActive, true)),
  })
  if (plan) {
    await db.insert(subscriptions).values({
      userId: session.user.id,
      planId: plan.id,
      instanceId: instance.id,
      interval: billingInterval,
      status: "active",
    })
  }

  await db.insert(instanceLogs).values({
    instanceId: instance.id,
    level: "info",
    message: "Dev mode: instance auto-activated (Stripe not configured).",
  })

  return NextResponse.json({ instanceId: instance.id })
}
