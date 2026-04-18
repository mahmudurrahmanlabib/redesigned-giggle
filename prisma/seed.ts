import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { hashSync } from "bcryptjs"
import { REGIONS } from "../src/configs/regions"
import { SERVER_TYPES } from "../src/configs/server-types"
import { PLANS } from "../src/configs/plans"

const prisma = new PrismaClient()

async function main() {
  // 1. Admin user
  const adminEmail = process.env.ADMIN_EMAIL || "admin@sovereignml.com"
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123456"

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Admin",
      hashedPassword: hashSync(adminPassword, 10),
      role: "admin",
    },
  })

  // 2. Regions
  for (const region of REGIONS) {
    await prisma.region.upsert({
      where: { slug: region.slug },
      update: {
        name: region.name,
        country: region.country,
        flag: region.flag,
        available: region.available,
        sortOrder: region.sortOrder,
      },
      create: {
        slug: region.slug,
        name: region.name,
        country: region.country,
        flag: region.flag,
        available: region.available,
        sortOrder: region.sortOrder,
      },
    })
  }

  // 3. Server configs (CX / CPX / CAX / CCX)
  for (const config of SERVER_TYPES) {
    await prisma.serverConfig.upsert({
      where: { slug: config.slug },
      update: {
        category: config.category,
        label: config.label,
        vcpu: config.vcpu,
        ramGb: config.ramGb,
        storageGb: config.storageGb,
        priceMonthly: config.priceMonthly,
        priceYearly: config.priceYearly,
        sortOrder: config.sortOrder,
        isActive: config.isActive,
      },
      create: {
        slug: config.slug,
        category: config.category,
        label: config.label,
        vcpu: config.vcpu,
        ramGb: config.ramGb,
        storageGb: config.storageGb,
        priceMonthly: config.priceMonthly,
        priceYearly: config.priceYearly,
        sortOrder: config.sortOrder,
        isActive: config.isActive,
      },
    })
  }

  // 4. Subscription plans
  // credits-per-period is set per tier per the bot factory plan
  // (Free=1k · Pro=20k · Scale=100k). Mapped from PlanTier:
  //   starter → 1_000, pro → 20_000, enterprise → 100_000.
  const CREDITS_PER_PERIOD: Record<string, number> = {
    starter: 1_000,
    pro: 20_000,
    enterprise: 100_000,
  }
  for (const plan of PLANS) {
    const credits = CREDITS_PER_PERIOD[plan.tier] ?? 0
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        description: plan.description,
        tier: plan.tier,
        stripePriceIdMonthly: plan.stripePriceIdMonthly || null,
        stripePriceIdYearly: plan.stripePriceIdYearly || null,
        features: plan.features,
        isActive: plan.isActive,
        sortOrder: plan.sortOrder,
        creditsPerPeriod: credits,
      },
      create: {
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        tier: plan.tier,
        stripePriceIdMonthly: plan.stripePriceIdMonthly || null,
        stripePriceIdYearly: plan.stripePriceIdYearly || null,
        features: plan.features,
        isActive: plan.isActive,
        sortOrder: plan.sortOrder,
        creditsPerPeriod: credits,
      },
    })
  }

  console.log(
    `Seed complete: ${REGIONS.length} regions, ${SERVER_TYPES.length} server configs, ${PLANS.length} plans, 1 admin user.`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
