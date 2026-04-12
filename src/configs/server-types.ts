// Server type catalog. Hetzner-inspired tiers, USD prices, clearly placeholder.
// Categories: CX (Standard), CPX (Performance), CAX (ARM), CCX (Dedicated).
// Edit here to update pricing across the deploy wizard, landing page, and seed.

export type ServerCategory = "CX" | "CPX" | "CAX" | "CCX"

export type ServerTypeConfig = {
  slug: string
  category: ServerCategory
  label: string
  vcpu: number
  ramGb: number
  storageGb: number
  priceMonthly: number
  priceYearly: number // ~2 months free
  sortOrder: number
  isActive: boolean
}

export const SERVER_CATEGORIES: ReadonlyArray<{
  category: ServerCategory
  title: string
  description: string
}> = [
  {
    category: "CX",
    title: "Standard",
    description: "Balanced general-purpose VPS for most AI workloads.",
  },
  {
    category: "CPX",
    title: "Performance",
    description: "Higher clock speed and boosted vCPU for inference-heavy agents.",
  },
  {
    category: "CAX",
    title: "ARM",
    description: "Cost-efficient ARM instances for high-throughput batch jobs.",
  },
  {
    category: "CCX",
    title: "Dedicated",
    description: "Dedicated vCPU on isolated hosts for production-critical agents.",
  },
] as const

export const SERVER_TYPES: readonly ServerTypeConfig[] = [
  // CX — Standard (shared vCPU, x86)
  { slug: "cx-22", category: "CX", label: "CX22", vcpu: 2, ramGb: 4, storageGb: 40, priceMonthly: 5.99, priceYearly: 59.9, sortOrder: 10, isActive: true },
  { slug: "cx-32", category: "CX", label: "CX32", vcpu: 4, ramGb: 8, storageGb: 80, priceMonthly: 11.99, priceYearly: 119.9, sortOrder: 20, isActive: true },
  { slug: "cx-42", category: "CX", label: "CX42", vcpu: 8, ramGb: 16, storageGb: 160, priceMonthly: 23.99, priceYearly: 239.9, sortOrder: 30, isActive: true },
  { slug: "cx-52", category: "CX", label: "CX52", vcpu: 16, ramGb: 32, storageGb: 320, priceMonthly: 47.99, priceYearly: 479.9, sortOrder: 40, isActive: true },

  // CPX — Performance (shared vCPU, AMD EPYC)
  { slug: "cpx-21", category: "CPX", label: "CPX21", vcpu: 3, ramGb: 4, storageGb: 80, priceMonthly: 8.49, priceYearly: 84.9, sortOrder: 10, isActive: true },
  { slug: "cpx-31", category: "CPX", label: "CPX31", vcpu: 4, ramGb: 8, storageGb: 160, priceMonthly: 15.99, priceYearly: 159.9, sortOrder: 20, isActive: true },
  { slug: "cpx-41", category: "CPX", label: "CPX41", vcpu: 8, ramGb: 16, storageGb: 240, priceMonthly: 30.99, priceYearly: 309.9, sortOrder: 30, isActive: true },
  { slug: "cpx-51", category: "CPX", label: "CPX51", vcpu: 16, ramGb: 32, storageGb: 360, priceMonthly: 60.99, priceYearly: 609.9, sortOrder: 40, isActive: true },

  // CAX — ARM (Ampere Altra)
  { slug: "cax-11", category: "CAX", label: "CAX11", vcpu: 2, ramGb: 4, storageGb: 40, priceMonthly: 4.49, priceYearly: 44.9, sortOrder: 10, isActive: true },
  { slug: "cax-21", category: "CAX", label: "CAX21", vcpu: 4, ramGb: 8, storageGb: 80, priceMonthly: 8.99, priceYearly: 89.9, sortOrder: 20, isActive: true },
  { slug: "cax-31", category: "CAX", label: "CAX31", vcpu: 8, ramGb: 16, storageGb: 160, priceMonthly: 17.99, priceYearly: 179.9, sortOrder: 30, isActive: true },
  { slug: "cax-41", category: "CAX", label: "CAX41", vcpu: 16, ramGb: 32, storageGb: 320, priceMonthly: 35.99, priceYearly: 359.9, sortOrder: 40, isActive: true },

  // CCX — Dedicated (dedicated vCPU)
  { slug: "ccx-13", category: "CCX", label: "CCX13", vcpu: 2, ramGb: 8, storageGb: 80, priceMonthly: 21.99, priceYearly: 219.9, sortOrder: 10, isActive: true },
  { slug: "ccx-23", category: "CCX", label: "CCX23", vcpu: 4, ramGb: 16, storageGb: 160, priceMonthly: 43.99, priceYearly: 439.9, sortOrder: 20, isActive: true },
  { slug: "ccx-33", category: "CCX", label: "CCX33", vcpu: 8, ramGb: 32, storageGb: 240, priceMonthly: 87.99, priceYearly: 879.9, sortOrder: 30, isActive: true },
  { slug: "ccx-43", category: "CCX", label: "CCX43", vcpu: 16, ramGb: 64, storageGb: 360, priceMonthly: 175.99, priceYearly: 1759.9, sortOrder: 40, isActive: true },
] as const

// Storage volume add-on, charged per-GB-month.
export const STORAGE_PRICE_PER_GB_MONTH = 0.05

// Yearly multiplier — applied to monthly base when billing yearly.
// Yearly already includes ~2 months free in priceYearly, so this is just a marker.
export const YEARLY_DISCOUNT_PERCENT = 17 // ~2 months free

// Storage slider bounds for the deploy wizard.
export const STORAGE_MIN_GB = 0
export const STORAGE_MAX_GB = 1000
export const STORAGE_STEP_GB = 50
