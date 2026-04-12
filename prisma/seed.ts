import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import { hashSync } from "bcryptjs"
import { REGIONS } from "../src/configs/regions"
import { SERVER_TYPES } from "../src/configs/server-types"
import { PLANS } from "../src/configs/plans"

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./dev.db",
})
const prisma = new PrismaClient({ adapter })

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
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        description: plan.description,
        tier: plan.tier,
        stripePriceIdMonthly: plan.stripePriceIdMonthly || null,
        stripePriceIdYearly: plan.stripePriceIdYearly || null,
        features: JSON.stringify(plan.features),
        isActive: plan.isActive,
        sortOrder: plan.sortOrder,
      },
      create: {
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        tier: plan.tier,
        stripePriceIdMonthly: plan.stripePriceIdMonthly || null,
        stripePriceIdYearly: plan.stripePriceIdYearly || null,
        features: JSON.stringify(plan.features),
        isActive: plan.isActive,
        sortOrder: plan.sortOrder,
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
