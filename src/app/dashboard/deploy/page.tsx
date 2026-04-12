"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { REGIONS, type RegionConfig } from "@/configs/regions"
import {
  SERVER_TYPES,
  SERVER_CATEGORIES,
  STORAGE_MIN_GB,
  STORAGE_MAX_GB,
  STORAGE_STEP_GB,
  type ServerTypeConfig,
  type ServerCategory,
} from "@/configs/server-types"
import { calcInstancePrice, formatUsd } from "@/lib/pricing"
import type { BillingInterval } from "@/lib/pricing"

type Step = "project" | "region" | "billing" | "server" | "advanced" | "review"
const STEPS: Step[] = ["project", "region", "billing", "server", "advanced", "review"]

const STEP_LABELS: Record<Step, string> = {
  project: "Project",
  region: "Location",
  billing: "Billing",
  server: "Server",
  advanced: "Advanced",
  review: "Review & Deploy",
}

export default function DeployPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("project")
  const [deploying, setDeploying] = useState(false)

  const [projectName, setProjectName] = useState("")
  const [selectedRegion, setSelectedRegion] = useState<RegionConfig | null>(null)
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("month")
  const [selectedCategory, setSelectedCategory] = useState<ServerCategory>("CX")
  const [selectedServer, setSelectedServer] = useState<ServerTypeConfig | null>(null)
  const [rootPassword, setRootPassword] = useState("")
  const [sshKey, setSshKey] = useState("")
  const [extraStorageGb, setExtraStorageGb] = useState(0)

  const stepIdx = STEPS.indexOf(step)
  const canNext = (() => {
    switch (step) {
      case "project":
        return projectName.trim().length >= 2
      case "region":
        return !!selectedRegion
      case "billing":
        return true
      case "server":
        return !!selectedServer
      case "advanced":
        return true
      case "review":
        return true
    }
  })()

  function next() {
    if (stepIdx < STEPS.length - 1) setStep(STEPS[stepIdx + 1])
  }
  function prev() {
    if (stepIdx > 0) setStep(STEPS[stepIdx - 1])
  }

  const price = selectedServer
    ? calcInstancePrice({
        serverConfig: selectedServer,
        storageGb: extraStorageGb,
        interval: billingInterval,
      })
    : null

  async function handleDeploy() {
    if (!selectedServer || !selectedRegion || !projectName.trim()) return
    setDeploying(true)
    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName.trim(),
          regionSlug: selectedRegion.slug,
          serverConfigSlug: selectedServer.slug,
          billingInterval,
          extraStorageGb,
          rootPassword: rootPassword || undefined,
          sshPublicKey: sshKey || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Deployment failed")
        return
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else {
        toast.success("Instance created! Redirecting...")
        router.push("/dashboard/instances")
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setDeploying(false)
    }
  }

  const filteredServers = SERVER_TYPES.filter(
    (s) => s.category === selectedCategory && s.isActive
  )

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Deploy AI Agent</h1>
        <p className="text-zinc-400 mt-1">Configure and launch your AI agent infrastructure.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => i <= stepIdx && setStep(s)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all duration-200 ${
              s === step
                ? "bg-[var(--accent-dim)] text-[var(--accent-color)] font-medium border border-[var(--accent-color)]/30"
                : i < stepIdx
                ? "text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                : "text-[var(--text-secondary)]/50 cursor-default"
            }`}
          >
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              s === step
                ? "bg-[var(--accent-color)] text-black"
                : i < stepIdx
                ? "bg-emerald-600 text-white"
                : "bg-white/5 text-[var(--text-secondary)]"
            }`}>
              {i < stepIdx ? "\u2713" : i + 1}
            </span>
            {STEP_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Step content */}
      <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-6 md:p-8">
        {/* STEP: Project */}
        {step === "project" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Project Name</h2>
              <p className="text-sm text-zinc-500">Give your deployment a name. This becomes its slug identifier.</p>
            </div>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="my-ai-agent"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
            {projectName && (
              <p className="text-xs text-zinc-500">
                Slug: <span className="text-zinc-300 font-mono">{projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}</span>
              </p>
            )}
          </div>
        )}

        {/* STEP: Region */}
        {step === "region" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Server Location</h2>
              <p className="text-sm text-zinc-500">Choose the region closest to your users for optimal latency.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {REGIONS.map((r) => (
                <button
                  key={r.slug}
                  disabled={!r.available}
                  onClick={() => setSelectedRegion(r)}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                    selectedRegion?.slug === r.slug
                      ? "border-[var(--accent-color)] bg-[var(--accent-dim)]"
                      : r.available
                      ? "border-[var(--border-color)] bg-[var(--card-bg)] hover:border-[var(--accent-color)] hover:bg-[var(--card-hover)]"
                      : "border-[var(--border-color)]/50 bg-[var(--card-bg)]/50 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <span className="text-2xl">{r.flag}</span>
                  <div>
                    <p className="text-white font-medium text-sm">{r.name}</p>
                    <p className="text-zinc-500 text-xs">{r.country}</p>
                  </div>
                  {!r.available && (
                    <span className="ml-auto text-xs text-zinc-600 border border-zinc-800 rounded px-2 py-0.5">Soon</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP: Billing */}
        {step === "billing" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Billing Cycle</h2>
              <p className="text-sm text-zinc-500">Choose monthly flexibility or save ~17% with yearly billing.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {(["month", "year"] as BillingInterval[]).map((interval) => (
                <button
                  key={interval}
                  onClick={() => setBillingInterval(interval)}
                  className={`p-6 rounded-xl border text-center transition-all ${
                    billingInterval === interval
                      ? "border-[var(--accent-color)] bg-[var(--accent-dim)]"
                      : "border-[var(--border-color)] bg-[var(--card-bg)] hover:border-[var(--accent-color)]"
                  }`}
                >
                  <p className="text-white font-semibold text-lg">
                    {interval === "month" ? "Monthly" : "Yearly"}
                  </p>
                  <p className="text-zinc-500 text-sm mt-1">
                    {interval === "month" ? "Pay month-to-month" : "Save ~17% (2 months free)"}
                  </p>
                  {interval === "year" && (
                    <span className="inline-block mt-2 text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                      Best Value
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP: Server */}
        {step === "server" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Server Type</h2>
              <p className="text-sm text-zinc-500">Select the hardware that fits your AI workload.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SERVER_CATEGORIES.map((cat) => (
                <button
                  key={cat.category}
                  onClick={() => { setSelectedCategory(cat.category); setSelectedServer(null) }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedCategory === cat.category
                      ? "bg-[var(--accent-color)] text-black"
                      : "bg-transparent text-[var(--text-secondary)] border border-[var(--border-color)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)]"
                  }`}
                >
                  {cat.category} — {cat.title}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500">
              {SERVER_CATEGORIES.find((c) => c.category === selectedCategory)?.description}
            </p>
            <div className="space-y-2">
              {filteredServers.map((s) => (
                <button
                  key={s.slug}
                  onClick={() => setSelectedServer(s)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                    selectedServer?.slug === s.slug
                      ? "border-[var(--accent-color)] bg-[var(--accent-dim)]"
                      : "border-[var(--border-color)] bg-[var(--card-bg)] hover:border-[var(--accent-color)]"
                  }`}
                >
                  <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-white font-medium">{s.label}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-zinc-300">{s.vcpu} vCPU</p>
                    </div>
                    <div className="text-center">
                      <p className="text-zinc-300">{s.ramGb} GB RAM</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-semibold">
                        ${billingInterval === "year" ? s.priceYearly : s.priceMonthly}
                        <span className="text-zinc-500 font-normal">
                          /{billingInterval === "year" ? "yr" : "mo"}
                        </span>
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP: Advanced */}
        {step === "advanced" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Advanced Options</h2>
              <p className="text-sm text-zinc-500">Optional configuration. You can skip this step.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-300 mb-2">Root Password</label>
                <input
                  type="password"
                  value={rootPassword}
                  onChange={(e) => setRootPassword(e.target.value)}
                  placeholder="Leave blank for auto-generated"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-300 mb-2">SSH Public Key</label>
                <textarea
                  value={sshKey}
                  onChange={(e) => setSshKey(e.target.value)}
                  placeholder="ssh-ed25519 AAAA..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors font-mono text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-300 mb-2">
                  Extra Storage: {extraStorageGb} GB
                  {extraStorageGb > 0 && (
                    <span className="text-zinc-500 ml-2">
                      (+${(extraStorageGb * 0.05).toFixed(2)}/mo)
                    </span>
                  )}
                </label>
                <input
                  type="range"
                  min={STORAGE_MIN_GB}
                  max={STORAGE_MAX_GB}
                  step={STORAGE_STEP_GB}
                  value={extraStorageGb}
                  onChange={(e) => setExtraStorageGb(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-xs text-zinc-600 mt-1">
                  <span>{STORAGE_MIN_GB} GB</span>
                  <span>{STORAGE_MAX_GB} GB</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP: Review */}
        {step === "review" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Review & Deploy</h2>
              <p className="text-sm text-zinc-500">Confirm your configuration before deploying.</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Project</p>
                  <p className="text-white font-medium">{projectName}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Region</p>
                  <p className="text-white font-medium">{selectedRegion?.flag} {selectedRegion?.name}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Server</p>
                  <p className="text-white font-medium">{selectedServer?.label} ({selectedServer?.vcpu} vCPU, {selectedServer?.ramGb} GB RAM)</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Billing</p>
                  <p className="text-white font-medium">{billingInterval === "year" ? "Yearly" : "Monthly"}</p>
                </div>
                {extraStorageGb > 0 && (
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Extra Storage</p>
                    <p className="text-white font-medium">{extraStorageGb} GB</p>
                  </div>
                )}
                {sshKey && (
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">SSH Key</p>
                    <p className="text-white font-medium font-mono text-xs truncate">{sshKey.slice(0, 40)}...</p>
                  </div>
                )}
              </div>

              {/* Price breakdown */}
              {price && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-6 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Server ({selectedServer?.label})</span>
                    <span className="text-white">{formatUsd(price.serverPrice)}</span>
                  </div>
                  {price.storagePrice > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Extra Storage ({extraStorageGb} GB)</span>
                      <span className="text-white">{formatUsd(price.storagePrice)}</span>
                    </div>
                  )}
                  <div className="border-t border-white/10 pt-3 flex justify-between">
                    <span className="text-white font-semibold">Total</span>
                    <span className="text-white font-bold text-xl">
                      {formatUsd(price.total)}
                      <span className="text-zinc-500 text-sm font-normal">
                        /{billingInterval === "year" ? "year" : "month"}
                      </span>
                    </span>
                  </div>
                  {price.yearlyDiscountApplied && (
                    <p className="text-emerald-400 text-xs">~17% savings with yearly billing</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={prev}
          disabled={stepIdx === 0}
          className="px-6 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Back
        </button>
        <div className="flex items-center gap-3">
          {step === "review" ? (
            <button
              onClick={handleDeploy}
              disabled={deploying || !canNext}
              className="btn-primary font-semibold px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deploying ? "Deploying..." : "Deploy Agent"}
            </button>
          ) : (
            <button
              onClick={next}
              disabled={!canNext}
              className="btn-primary font-semibold px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
