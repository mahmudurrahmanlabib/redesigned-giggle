"use client"

import { useEffect, useState } from "react"
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
import { AGENT_CATEGORIES } from "@/configs/agent-categories"
import { DEPLOY_TEMPLATES, estimateMonthlyCost } from "@/configs/deploy-templates"

type Tone = "formal" | "sales" | "technical" | "friendly"
type Interface = "web" | "telegram" | "discord" | "api"
type DeploymentTarget = "vps" | "shared" | "serverless"
type KnowledgeSource = "none" | "url" | "file"
type BudgetTier = "low" | "mid" | "high"

type AgentConfig = {
  use_case: string
  target_user: string
  core_actions: string[]
  tone: Tone
  interface: Interface
  deployment_target: DeploymentTarget
  knowledge_source: KnowledgeSource
  budget_tier: BudgetTier
}

const TONES: { value: Tone; label: string; hint: string }[] = [
  { value: "formal", label: "Formal", hint: "Precise, business-ready, measured" },
  { value: "sales", label: "Sales", hint: "Persuasive, benefit-led, CTA-driven" },
  { value: "technical", label: "Technical", hint: "Exact, jargon-aware, developer-focused" },
  { value: "friendly", label: "Friendly", hint: "Warm, approachable, conversational" },
]

const INTERFACES: { value: Interface; label: string; hint: string }[] = [
  { value: "web", label: "Web Chat", hint: "Embeddable widget on your site" },
  { value: "telegram", label: "Telegram", hint: "Bot under your Telegram handle" },
  { value: "discord", label: "Discord", hint: "Invite to your server" },
  { value: "api", label: "REST API", hint: "Programmatic access only" },
]

const DEPLOYMENT_TARGETS: { value: DeploymentTarget; label: string; hint: string }[] = [
  { value: "vps", label: "Dedicated VPS", hint: "Single-tenant, single instance, isolated" },
  { value: "shared", label: "Shared Cluster", hint: "Multi-tenant pool, cheapest, autoscaled" },
  { value: "serverless", label: "Serverless (Managed)", hint: "We run it — pay per request only" },
]

const BUDGETS: { value: BudgetTier; label: string; hint: string }[] = [
  { value: "low", label: "Low", hint: "Fast & cheap · OpenRouter small models" },
  { value: "mid", label: "Mid", hint: "Balanced · GPT-4o-mini / GLM-4" },
  { value: "high", label: "High", hint: "Best available · Claude Opus / GPT-4.1" },
]

type Step = "purpose" | "interface" | "capability" | "project" | "region" | "billing" | "server" | "advanced" | "domain" | "review"
const ALL_STEPS: Step[] = ["purpose", "interface", "capability", "project", "region", "billing", "server", "advanced", "domain", "review"]
const SERVERLESS_SKIP: Step[] = ["region", "server", "advanced", "domain"]
function stepsFor(target: DeploymentTarget): Step[] {
  return target === "vps" ? ALL_STEPS : ALL_STEPS.filter((s) => !SERVERLESS_SKIP.includes(s))
}

function deploymentSlug(raw: string) {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

const STEP_LABELS: Record<Step, string> = {
  purpose: "Purpose",
  interface: "Interface",
  capability: "Capability",
  project: "Project",
  region: "Location",
  billing: "Billing",
  server: "Server",
  advanced: "Advanced",
  domain: "Domain",
  review: "Review & Deploy",
}

const DOMAIN_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

export default function DeployPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("purpose")
  const [deploying, setDeploying] = useState(false)

  // Agent intake
  const [useCase, setUseCase] = useState<string>("")
  const [targetUser, setTargetUser] = useState<string>("")
  const [tone, setTone] = useState<Tone>("formal")
  const [interfaceKind, setInterfaceKind] = useState<Interface>("web")
  const [deploymentTarget, setDeploymentTarget] = useState<DeploymentTarget>("vps")
  const [coreActions, setCoreActions] = useState<string[]>([])
  const [knowledgeSource, setKnowledgeSource] = useState<KnowledgeSource>("none")
  const [budgetTier, setBudgetTier] = useState<BudgetTier>("mid")

  // Telegram interface binding
  const [telegramMode, setTelegramMode] = useState<"immediate" | "deferred">("deferred")
  const [telegramToken, setTelegramToken] = useState<string>("")

  const [projectName, setProjectName] = useState("")
  const [selectedRegion, setSelectedRegion] = useState<RegionConfig | null>(null)
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("month")
  const [selectedCategory, setSelectedCategory] = useState<ServerCategory>("CX")
  const [selectedServer, setSelectedServer] = useState<ServerTypeConfig | null>(null)
  const [rootPassword, setRootPassword] = useState("")
  const [sshKey, setSshKey] = useState("")
  const [extraStorageGb, setExtraStorageGb] = useState(0)
  const [domain, setDomain] = useState("")

  const STEPS = stepsFor(deploymentTarget)
  // Keep current step valid when toggling between VPS and serverless
  useEffect(() => {
    if (!STEPS.includes(step)) setStep("billing")
  }, [STEPS, step])
  const stepIdx = STEPS.indexOf(step)
  const selectedCategoryObj = AGENT_CATEGORIES.find((c) => c.slug === useCase)
  const telegramImmediateInvalid =
    interfaceKind === "telegram" &&
    telegramMode === "immediate" &&
    !/^\d{6,12}:[A-Za-z0-9_-]{30,}$/.test(telegramToken.trim())
  const canNext = (() => {
    switch (step) {
      case "purpose":
        return !!useCase && targetUser.trim().length >= 2 && !!tone
      case "interface":
        return !!interfaceKind && !!deploymentTarget && !telegramImmediateInvalid
      case "capability":
        return coreActions.length > 0
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
      case "domain":
        return domain.trim() === "" || DOMAIN_RE.test(domain.trim().toLowerCase())
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
    if (!projectName.trim()) return
    if (deploymentTarget === "vps" && (!selectedServer || !selectedRegion)) return
    setDeploying(true)
    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName.trim(),
          regionSlug: deploymentTarget === "vps" ? selectedRegion?.slug : undefined,
          serverConfigSlug: deploymentTarget === "vps" ? selectedServer?.slug : undefined,
          billingInterval,
          extraStorageGb: deploymentTarget === "vps" ? extraStorageGb : 0,
          rootPassword: deploymentTarget === "vps" ? (rootPassword || undefined) : undefined,
          sshPublicKey: deploymentTarget === "vps" ? (sshKey || undefined) : undefined,
          domain: deploymentTarget === "vps" && domain.trim() ? domain.trim().toLowerCase() : undefined,
          agentConfig: {
            use_case: useCase,
            target_user: targetUser.trim(),
            core_actions: coreActions,
            tone,
            interface: interfaceKind,
            deployment_target: deploymentTarget,
            knowledge_source: knowledgeSource,
            budget_tier: budgetTier,
          } satisfies AgentConfig,
          interfaceBinding:
            interfaceKind === "telegram"
              ? telegramMode === "immediate"
                ? { kind: "telegram", mode: "immediate", token: telegramToken.trim() }
                : { kind: "telegram", mode: "deferred" }
              : { kind: interfaceKind, mode: "immediate" },
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

  const slugPreview = deploymentSlug(projectName)

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Deploy AI Agent</h1>
        <p className="text-[var(--text-secondary)] mt-1">Configure and launch your AI agent infrastructure.</p>
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
                ? "bg-emerald-600 text-[var(--text-primary)]"
                : "bg-[var(--card-bg)] text-[var(--text-secondary)]"
            }`}>
              {i < stepIdx ? "\u2713" : i + 1}
            </span>
            {STEP_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Step content */}
      <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-6 md:p-8">
        {/* STEP: Purpose */}
        {step === "purpose" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Agent Purpose</h2>
              <p className="text-sm text-[var(--text-secondary)]">What will this agent do, and who is it for?</p>
            </div>

            <div className="border border-[var(--accent-color)]/40 bg-[var(--accent-dim)]/30 p-4">
              <p className="text-[10px] uppercase tracking-[0.1em] font-mono text-[var(--accent-color)] mb-3">
                Quick start · pick a template
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {DEPLOY_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setUseCase(t.useCase)
                      setTone(t.tone as Tone)
                      setInterfaceKind(t.interfaceKind as Interface)
                      setDeploymentTarget(t.deploymentTarget as DeploymentTarget)
                      setBudgetTier(t.budgetTier as BudgetTier)
                      setKnowledgeSource(t.knowledgeSource as KnowledgeSource)
                      const cat = AGENT_CATEGORIES.find((c) => c.slug === t.useCase)
                      setCoreActions(t.coreActionHints.length > 0 ? t.coreActionHints : (cat?.examples.slice(0, 2) ?? []))
                      if (!targetUser) setTargetUser(cat?.description.split(".")[0] ?? "")
                      toast.success(`${t.name} template applied`)
                    }}
                    className="flex items-start gap-3 p-3 border border-[var(--border-color)] bg-[var(--card-bg)] hover:border-[var(--accent-color)] text-left transition-all"
                  >
                    <span className="text-xl">{t.icon}</span>
                    <div>
                      <p className="text-[var(--text-primary)] text-sm font-medium">{t.name}</p>
                      <p className="text-[var(--text-secondary)] text-[11px] mt-0.5 line-clamp-2">{t.tagline}</p>
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-[10px] font-mono text-[var(--text-secondary)] mt-3">
                Templates pre-fill the rest — you can still edit anything before deploying.
              </p>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-2">Use Case</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {AGENT_CATEGORIES.map((cat) => (
                  <button
                    key={cat.slug}
                    onClick={() => { setUseCase(cat.slug); setCoreActions([]) }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      useCase === cat.slug
                        ? "border-[var(--accent-color)] bg-[var(--accent-dim)]"
                        : "border-[var(--border-color)] bg-[var(--card-bg)] hover:border-[var(--accent-color)]"
                    }`}
                  >
                    <p className="text-[var(--text-primary)] font-medium text-sm">{cat.name}</p>
                    <p className="text-[var(--text-secondary)] text-xs mt-1 line-clamp-2">{cat.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-2">Target User</label>
              <input
                type="text"
                value={targetUser}
                onChange={(e) => setTargetUser(e.target.value)}
                placeholder="e.g. SaaS customers, internal devs, enterprise buyers"
                className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-color)]/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-2">Tone <span className="text-[var(--text-secondary)] normal-case">· how the bot behaves</span></label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {TONES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTone(t.value)}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                      tone === t.value
                        ? "border-[var(--accent-color)] bg-[var(--accent-dim)]"
                        : "border-[var(--border-color)] bg-[var(--card-bg)] hover:border-[var(--accent-color)]"
                    }`}
                  >
                    <p className="text-[var(--text-primary)] text-sm font-medium">{t.label}</p>
                    <p className="text-[var(--text-secondary)] text-xs">{t.hint}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP: Interface */}
        {step === "interface" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Interface & Deployment</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                <span className="text-[var(--text-primary)]">Interface</span> is where the bot lives.
                <span className="text-[var(--text-primary)] ml-1">Deployment</span> is how it runs. These are separate.
              </p>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-2">Interface · where users reach the bot</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {INTERFACES.map((i) => (
                  <button
                    key={i.value}
                    onClick={() => setInterfaceKind(i.value)}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                      interfaceKind === i.value
                        ? "border-[var(--accent-color)] bg-[var(--accent-dim)]"
                        : "border-[var(--border-color)] bg-[var(--card-bg)] hover:border-[var(--accent-color)]"
                    }`}
                  >
                    <p className="text-[var(--text-primary)] text-sm font-medium">{i.label}</p>
                    <p className="text-[var(--text-secondary)] text-xs">{i.hint}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-2">Deployment Target · how the bot runs</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {DEPLOYMENT_TARGETS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDeploymentTarget(d.value)}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                      deploymentTarget === d.value
                        ? "border-[var(--accent-color)] bg-[var(--accent-dim)]"
                        : "border-[var(--border-color)] bg-[var(--card-bg)] hover:border-[var(--accent-color)]"
                    }`}
                  >
                    <p className="text-[var(--text-primary)] text-sm font-medium">{d.label}</p>
                    <p className="text-[var(--text-secondary)] text-xs">{d.hint}</p>
                  </button>
                ))}
              </div>
              {deploymentTarget !== "vps" && (
                <p className="text-xs text-[var(--accent-color)] mt-2 font-mono">
                  ℹ {deploymentTarget === "serverless" ? "Serverless" : "Shared cluster"} skips region/server/advanced steps — infra is fully managed.
                </p>
              )}
            </div>

            {interfaceKind === "telegram" && (
              <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)] rounded-xl p-4 space-y-3">
                <p className="text-xs uppercase tracking-wide text-[var(--accent-color)] font-mono">Telegram Binding</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <button
                    onClick={() => setTelegramMode("immediate")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      telegramMode === "immediate"
                        ? "border-[var(--accent-color)] bg-[var(--accent-dim)]"
                        : "border-[var(--border-color)] bg-[var(--card-bg)] hover:border-[var(--accent-color)]"
                    }`}
                  >
                    <p className="text-[var(--text-primary)] text-sm font-medium">Connect now</p>
                    <p className="text-[var(--text-secondary)] text-xs">Paste your BotFather token — we bind before launch.</p>
                  </button>
                  <button
                    onClick={() => setTelegramMode("deferred")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      telegramMode === "deferred"
                        ? "border-[var(--accent-color)] bg-[var(--accent-dim)]"
                        : "border-[var(--border-color)] bg-[var(--card-bg)] hover:border-[var(--accent-color)]"
                    }`}
                  >
                    <p className="text-[var(--text-primary)] text-sm font-medium">Connect later</p>
                    <p className="text-[var(--text-secondary)] text-xs">Deploy without Telegram — bind from the Interfaces tab.</p>
                  </button>
                </div>

                {telegramMode === "immediate" && (
                  <div>
                    <label className="block text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-2">Bot Token</label>
                    <input
                      type="password"
                      value={telegramToken}
                      onChange={(e) => setTelegramToken(e.target.value)}
                      placeholder="123456789:ABCDEF-Gh1Jk2Lm3Nop4Qr5St6Uv7Wx8Yz"
                      className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/40 font-mono text-sm focus:outline-none focus:border-[var(--accent-color)]/50"
                    />
                    {telegramToken && telegramImmediateInvalid && (
                      <p className="text-xs text-amber-400 mt-2">Token format looks off. Expected `NNNN:LONGSTRING` from @BotFather.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP: Capability */}
        {step === "capability" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Capabilities</h2>
              <p className="text-sm text-[var(--text-secondary)]">Pick the core actions your agent should handle. Your budget tier controls which model powers it.</p>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-2">
                Core Actions {selectedCategoryObj && <span className="text-[var(--text-secondary)] normal-case">· suggested from {selectedCategoryObj.name}</span>}
              </label>
              <div className="space-y-2">
                {(selectedCategoryObj?.examples ?? []).map((action) => {
                  const checked = coreActions.includes(action)
                  return (
                    <button
                      key={action}
                      onClick={() =>
                        setCoreActions((prev) =>
                          prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]
                        )
                      }
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                        checked
                          ? "border-[var(--accent-color)] bg-[var(--accent-dim)]"
                          : "border-[var(--border-color)] bg-[var(--card-bg)] hover:border-[var(--accent-color)]"
                      }`}
                    >
                      <span className={`w-4 h-4 border flex items-center justify-center text-[10px] font-bold ${
                        checked ? "border-[var(--accent-color)] bg-[var(--accent-color)] text-black" : "border-[var(--border-color)]"
                      }`}>
                        {checked ? "✓" : ""}
                      </span>
                      <span className="text-[var(--text-primary)] text-sm">{action}</span>
                    </button>
                  )
                })}
                {!selectedCategoryObj && (
                  <p className="text-sm text-amber-400/90">Go back and pick a use case first to see suggested actions.</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-2">Knowledge Source</label>
                <div className="space-y-2">
                  {(["none", "url", "file"] as KnowledgeSource[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => setKnowledgeSource(k)}
                      className={`w-full p-3 rounded-xl border text-left transition-all capitalize ${
                        knowledgeSource === k
                          ? "border-[var(--accent-color)] bg-[var(--accent-dim)]"
                          : "border-[var(--border-color)] bg-[var(--card-bg)] hover:border-[var(--accent-color)]"
                      }`}
                    >
                      <p className="text-[var(--text-primary)] text-sm font-medium">{k === "none" ? "No external knowledge" : k}</p>
                      <p className="text-[var(--text-secondary)] text-xs">
                        {k === "none" && "Pure LLM, no retrieval."}
                        {k === "url" && "Crawl URLs into a vector store at deploy."}
                        {k === "file" && "Upload documents after deploy."}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-2">Budget Tier</label>
                <div className="space-y-2">
                  {BUDGETS.map((b) => {
                    const est = estimateMonthlyCost(b.value, 500)
                    return (
                      <button
                        key={b.value}
                        onClick={() => setBudgetTier(b.value)}
                        className={`w-full p-3 rounded-xl border text-left transition-all ${
                          budgetTier === b.value
                            ? "border-[var(--accent-color)] bg-[var(--accent-dim)]"
                            : "border-[var(--border-color)] bg-[var(--card-bg)] hover:border-[var(--accent-color)]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-[var(--text-primary)] text-sm font-medium">{b.label}</p>
                          <p className="text-[10px] font-mono text-[var(--accent-color)]">
                            ~${est.usd.toFixed(2)}/mo · {est.credits.toLocaleString()} cr
                          </p>
                        </div>
                        <p className="text-[var(--text-secondary)] text-xs">{b.hint}</p>
                        <p className="text-[10px] font-mono text-[var(--text-secondary)]/70 mt-1">
                          est. @ 500 req/day · dummy
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP: Project */}
        {step === "project" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Project Name</h2>
              <p className="text-sm text-[var(--text-secondary)]">Give your deployment a name. This becomes its slug identifier.</p>
            </div>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="my-ai-agent"
              className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] px-4 py-3">
              <p className="text-[0.65rem] font-medium uppercase tracking-wide text-[var(--text-secondary)] mb-1">
                URL slug
              </p>
              <p className="font-mono text-sm text-[var(--text-primary)] break-all">
                {slugPreview || (
                  <span className="text-[var(--text-secondary)] not-italic">
                    Type a name to preview (letters, numbers, spaces, and hyphens).
                  </span>
                )}
              </p>
              {projectName.trim().length > 0 && projectName.trim().length < 2 && (
                <p className="text-xs text-amber-400/90 mt-2">
                  Enter at least 2 characters to continue — that keeps deployment names unique.
                </p>
              )}
            </div>
          </div>
        )}

        {/* STEP: Region */}
        {step === "region" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border border-[var(--border-color)] bg-[var(--card-bg)] px-4 py-2.5 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--accent-color)] animate-pulse" />
                <p className="text-xs font-mono text-[var(--text-primary)]">All regions operational</p>
              </div>
              <p className="text-[10px] font-mono text-[var(--text-secondary)]/70">status · dummy</p>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Server Location</h2>
              <p className="text-sm text-[var(--text-secondary)]">Choose the region closest to your users for optimal latency.</p>
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
                    <p className="text-[var(--text-primary)] font-medium text-sm">{r.name}</p>
                    <p className="text-[var(--text-secondary)] text-xs">{r.country}</p>
                  </div>
                  {!r.available && (
                    <span className="ml-auto text-xs text-[var(--text-secondary)]/50 border border-zinc-800 rounded px-2 py-0.5">Soon</span>
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
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Billing Cycle</h2>
              <p className="text-sm text-[var(--text-secondary)]">Choose monthly flexibility or save ~17% with yearly billing.</p>
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
                  <p className="text-[var(--text-primary)] font-semibold text-lg">
                    {interval === "month" ? "Monthly" : "Yearly"}
                  </p>
                  <p className="text-[var(--text-secondary)] text-sm mt-1">
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
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Server Type</h2>
              <p className="text-sm text-[var(--text-secondary)]">Select the hardware that fits your AI workload.</p>
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
            <p className="text-xs text-[var(--text-secondary)]">
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
                      <p className="text-[var(--text-primary)] font-medium">{s.label}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[var(--text-primary)]">{s.vcpu} vCPU</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[var(--text-primary)]">{s.ramGb} GB RAM</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[var(--text-primary)] font-semibold">
                        ${billingInterval === "year" ? s.priceYearly : s.priceMonthly}
                        <span className="text-[var(--text-secondary)] font-normal">
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
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Advanced Options</h2>
              <p className="text-sm text-[var(--text-secondary)]">Optional configuration. You can skip this step.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-primary)] mb-2">Root Password</label>
                <input
                  type="password"
                  value={rootPassword}
                  onChange={(e) => setRootPassword(e.target.value)}
                  placeholder="Leave blank for auto-generated"
                  className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--text-primary)] mb-2">SSH Public Key</label>
                <textarea
                  value={sshKey}
                  onChange={(e) => setSshKey(e.target.value)}
                  placeholder="ssh-ed25519 AAAA..."
                  rows={3}
                  className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-blue-500/50 transition-colors font-mono text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--text-primary)] mb-2">
                  Extra Storage: {extraStorageGb} GB
                  {extraStorageGb > 0 && (
                    <span className="text-[var(--text-secondary)] ml-2">
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
                <div className="flex justify-between text-xs text-[var(--text-secondary)]/50 mt-1">
                  <span>{STORAGE_MIN_GB} GB</span>
                  <span>{STORAGE_MAX_GB} GB</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP: Domain */}
        {step === "domain" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Custom Domain</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Optional. Enter a domain you own (e.g. <span className="font-mono">agent.example.com</span>). We&apos;ll serve your OpenClaw agent there with auto-issued SSL.
                You&apos;ll add an <span className="font-mono">A</span> record pointing to the server IP after provisioning — we&apos;ll show the exact value.
              </p>
            </div>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="agent.example.com"
              className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-color)]/50 transition-colors font-mono"
            />
            {domain.trim() && !DOMAIN_RE.test(domain.trim().toLowerCase()) && (
              <p className="text-xs text-amber-400 font-mono">Not a valid domain — expected like <span>agent.example.com</span></p>
            )}
            <p className="text-[11px] font-mono text-[var(--text-secondary)]">
              Leave blank to expose on the server IP over HTTP. You can attach a domain later.
            </p>
          </div>
        )}

        {/* STEP: Review */}
        {step === "review" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Review & Deploy</h2>
              <p className="text-sm text-[var(--text-secondary)]">Confirm your configuration before deploying.</p>
            </div>

            <div className="space-y-4">
              <div className="bg-[var(--card-bg)] rounded-xl p-4 border border-[var(--accent-color)]/30">
                <p className="text-[var(--accent-color)] text-xs uppercase tracking-wide mb-2 font-mono">Agent</p>
                <p className="text-[var(--text-primary)] font-medium">{selectedCategoryObj?.name ?? "—"}</p>
                <p className="text-[var(--text-secondary)] text-xs mt-1">
                  For: {targetUser || "—"} ·
                  <span className="ml-1">Tone: <span className="text-[var(--text-primary)] capitalize">{tone}</span></span> ·
                  <span className="ml-1">Interface: <span className="text-[var(--text-primary)] capitalize">{interfaceKind}</span></span> ·
                  <span className="ml-1">Deploy: <span className="text-[var(--text-primary)] capitalize">{deploymentTarget}</span></span> ·
                  <span className="ml-1">Model: <span className="text-[var(--text-primary)] uppercase">{budgetTier}</span></span>
                </p>
                {coreActions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {coreActions.map((a) => (
                      <span key={a} className="text-[10px] border border-[var(--border-color)] px-2 py-0.5 text-[var(--text-secondary)]">{a}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-[var(--card-bg)] rounded-xl p-4">
                  <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wide mb-1">Project</p>
                  <p className="text-[var(--text-primary)] font-medium">{projectName}</p>
                  <p className="text-[var(--text-secondary)] text-xs mt-2 font-mono">
                    slug: {slugPreview || "—"}
                  </p>
                </div>
                {deploymentTarget === "vps" ? (
                  <>
                    <div className="bg-[var(--card-bg)] rounded-xl p-4">
                      <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wide mb-1">Region</p>
                      <p className="text-[var(--text-primary)] font-medium">{selectedRegion?.flag} {selectedRegion?.name}</p>
                    </div>
                    <div className="bg-[var(--card-bg)] rounded-xl p-4">
                      <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wide mb-1">Server</p>
                      <p className="text-[var(--text-primary)] font-medium">{selectedServer?.label} ({selectedServer?.vcpu} vCPU, {selectedServer?.ramGb} GB RAM)</p>
                    </div>
                  </>
                ) : (
                  <div className="bg-[var(--card-bg)] rounded-xl p-4 col-span-2">
                    <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wide mb-1">Runtime</p>
                    <p className="text-[var(--text-primary)] font-medium capitalize">{deploymentTarget} — managed pool</p>
                    <p className="text-[var(--text-secondary)] text-xs mt-1">No region or server required. Billed per request from credits.</p>
                  </div>
                )}
                <div className="bg-[var(--card-bg)] rounded-xl p-4">
                  <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wide mb-1">Billing</p>
                  <p className="text-[var(--text-primary)] font-medium">{billingInterval === "year" ? "Yearly" : "Monthly"}</p>
                </div>
                {extraStorageGb > 0 && (
                  <div className="bg-[var(--card-bg)] rounded-xl p-4">
                    <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wide mb-1">Extra Storage</p>
                    <p className="text-[var(--text-primary)] font-medium">{extraStorageGb} GB</p>
                  </div>
                )}
                {sshKey && (
                  <div className="bg-[var(--card-bg)] rounded-xl p-4">
                    <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wide mb-1">SSH Key</p>
                    <p className="text-[var(--text-primary)] font-medium font-mono text-xs truncate">{sshKey.slice(0, 40)}...</p>
                  </div>
                )}
              </div>

              {/* Price breakdown */}
              {price && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-6 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">Server ({selectedServer?.label})</span>
                    <span className="text-[var(--text-primary)]">{formatUsd(price.serverPrice)}</span>
                  </div>
                  {price.storagePrice > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">Extra Storage ({extraStorageGb} GB)</span>
                      <span className="text-[var(--text-primary)]">{formatUsd(price.storagePrice)}</span>
                    </div>
                  )}
                  <div className="border-t border-[var(--border-color)] pt-3 flex justify-between">
                    <span className="text-[var(--text-primary)] font-semibold">Total</span>
                    <span className="text-[var(--text-primary)] font-bold text-xl">
                      {formatUsd(price.total)}
                      <span className="text-[var(--text-secondary)] text-sm font-normal">
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
          className="px-6 py-3 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
