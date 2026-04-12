// Pure pricing functions. Used by both the deploy wizard (preview) and
// the /api/checkout endpoint, so there's a single source of truth.

import { STORAGE_PRICE_PER_GB_MONTH, type ServerTypeConfig } from "@/configs/server-types"

export type BillingInterval = "month" | "year"

export type PriceBreakdown = {
  serverPrice: number
  storagePrice: number
  subtotal: number
  total: number
  interval: BillingInterval
  yearlyDiscountApplied: boolean
}

export type PriceInput = {
  serverConfig: Pick<ServerTypeConfig, "priceMonthly" | "priceYearly">
  storageGb: number
  interval: BillingInterval
}

export function calcInstancePrice({
  serverConfig,
  storageGb,
  interval,
}: PriceInput): PriceBreakdown {
  const isYearly = interval === "year"
  const serverPrice = isYearly
    ? serverConfig.priceYearly
    : serverConfig.priceMonthly

  // Storage is per-GB-month; multiply by 12 for yearly.
  const monthlyStorage = storageGb * STORAGE_PRICE_PER_GB_MONTH
  const storagePrice = isYearly ? monthlyStorage * 12 : monthlyStorage

  const subtotal = serverPrice + storagePrice
  const total = round2(subtotal)

  return {
    serverPrice: round2(serverPrice),
    storagePrice: round2(storagePrice),
    subtotal: round2(subtotal),
    total,
    interval,
    yearlyDiscountApplied: isYearly,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}
