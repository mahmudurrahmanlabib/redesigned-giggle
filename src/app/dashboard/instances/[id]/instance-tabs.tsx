"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { useRouter, usePathname } from "next/navigation"

type InstanceLite = {
  id: string
  name: string
  status: string
  ipAddress: string | null
  regionLabel: string
  serverLabel: string
  vcpu: number
  ramGb: number
  createdAt: string
  domain: string | null
  dnsStatus: string | null
  tlsStatus: string | null
  openclawAdminEmail: string | null
  hasOpenclawPassword: boolean
  hasRootPassword: boolean
  hasGatewayToken: boolean
  deploymentTarget: string | null
}

type LogLite = { id: string; level: string; message: string; createdAt: string }

type StatusPayload = {
  status: string
  ipAddress: string | null
  dnsStatus: string | null
  tlsStatus: string | null
  logs: LogLite[]
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "controls", label: "Controls" },
  { id: "interfaces", label: "Interfaces" },
  { id: "logs", label: "Logs" },
  { id: "danger", label: "Danger Zone" },
] as const

function useInstancePolling(instance: InstanceLite, initialLogs: LogLite[]) {
  const [status, setStatus] = useState(instance.status)
  const [ipAddress, setIpAddress] = useState(instance.ipAddress)
  const [dnsStatus, setDnsStatus] = useState(instance.dnsStatus)
  const [tlsStatus, setTlsStatus] = useState(instance.tlsStatus)
  const [logs, setLogs] = useState(initialLogs)
  const router = useRouter()
  const prevStatus = useRef(instance.status)

  // Poll while the row is moving through any non-terminal transition state.
  const isPolling =
    status === "pending" || status === "provisioning" || status === "deleting"

  useEffect(() => {
    if (!isPolling) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    async function poll() {
      try {
        const r = await fetch(`/api/instances/${instance.id}/status`, { cache: "no-store" })
        if (!r.ok || cancelled) return
        const data: StatusPayload = await r.json()
        setStatus(data.status)
        setIpAddress(data.ipAddress)
        setDnsStatus(data.dnsStatus)
        setTlsStatus(data.tlsStatus)
        setLogs(data.logs)

        const wasTransient =
          prevStatus.current === "pending" ||
          prevStatus.current === "provisioning" ||
          prevStatus.current === "deleting"
        const nowTransient =
          data.status === "pending" ||
          data.status === "provisioning" ||
          data.status === "deleting"
        if (!nowTransient && wasTransient) {
          prevStatus.current = data.status
          router.refresh()
          return
        }
      } catch {
        /* network error — retry next interval */
      }
      if (!cancelled) {
        timer = setTimeout(poll, 3_000)
      }
    }

    timer = setTimeout(poll, 1_500)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [instance.id, isPolling, router])

  return {
    instance: { ...instance, status, ipAddress, dnsStatus, tlsStatus },
    logs,
  }
}

export function InstanceTabs({
  active,
  instance: initialInstance,
  logs: initialLogs,
}: {
  active: string
  instance: InstanceLite
  logs: LogLite[]
}) {
  const { instance, logs } = useInstancePolling(initialInstance, initialLogs)
  const router = useRouter()
  const pathname = usePathname()

  function goTab(id: string) {
    router.push(`${pathname}?tab=${id}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-[var(--border-color)] overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => goTab(t.id)}
            className={`px-4 py-3 text-xs uppercase tracking-[0.08em] font-mono whitespace-nowrap border-b-2 transition-colors ${
              active === t.id
                ? "border-[var(--accent-color)] text-[var(--accent-color)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === "overview" && <OverviewTab instance={instance} logs={logs} />}
      {active === "controls" && <ControlsTab instance={instance} />}
      {active === "interfaces" && <InterfacesTab instance={instance} />}
      {active === "logs" && <LogsTab logs={logs} />}
      {active === "danger" && <DangerTab instance={instance} />}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-5">
      <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-[0.1em] font-mono mb-3">
        {title}
      </p>
      {children}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-[0.1em] font-mono">{label}</p>
      <p className="text-[var(--text-primary)] text-sm mt-1">{value}</p>
    </div>
  )
}

/* ───────────── DNS SETUP CARD ───────────── */
function DnsCard({ instance }: { instance: InstanceLite }) {
  const [dnsStatus, setDnsStatus] = useState(instance.dnsStatus)
  const [tlsStatus, setTlsStatus] = useState(instance.tlsStatus)
  const [resolvedIps, setResolvedIps] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    async function poll() {
      try {
        const r = await fetch(`/api/instances/${instance.id}/dns-status`, { cache: "no-store" })
        const j = (await r.json()) as {
          dnsStatus: string | null
          tlsStatus: string | null
          resolvedIps?: string[]
        }
        if (cancelled) return
        setDnsStatus(j.dnsStatus)
        setTlsStatus(j.tlsStatus)
        setResolvedIps(j.resolvedIps ?? [])
      } catch {
        /* ignore */
      }
      if (!cancelled && (dnsStatus !== "ready" || tlsStatus !== "issued")) {
        timer = setTimeout(poll, 10_000)
      }
    }
    poll()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance.id])

  async function copyIp() {
    if (!instance.ipAddress) return
    try {
      await navigator.clipboard.writeText(instance.ipAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  const ready = dnsStatus === "ready" && tlsStatus === "issued"
  const url = `https://${instance.domain}`

  return (
    <Card title={ready ? "Agent URL" : "DNS Setup"}>
      {ready ? (
        <div className="space-y-2">
          <p className="text-sm text-[var(--text-primary)]">
            Your agent is live at{" "}
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--accent-color)] underline font-mono"
            >
              {url}
            </a>
          </p>
          <p className="text-[10px] font-mono text-[var(--text-secondary)]">
            TLS certificate issued. DNS resolved to {resolvedIps.join(", ") || instance.ipAddress}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-secondary)]">
            Add this <span className="font-mono text-[var(--text-primary)]">A</span> record to your DNS provider for{" "}
            <span className="font-mono text-[var(--text-primary)]">{instance.domain}</span>:
          </p>
          <div className="font-mono text-sm bg-[var(--code-bg)] border border-[var(--border-color)] p-3 flex items-center justify-between gap-3">
            <span className="text-[var(--text-secondary)]">
              <span className="text-[var(--text-primary)]">{instance.domain}</span> →{" "}
              <span className="text-[var(--accent-color)]">{instance.ipAddress ?? "…"}</span>
            </span>
            <button
              onClick={copyIp}
              className="px-2 py-1 text-[10px] uppercase tracking-[0.08em] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent-color)]"
            >
              {copied ? "Copied" : "Copy IP"}
            </button>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-[0.08em]">
            <span className="text-[var(--text-secondary)]">
              DNS:{" "}
              <span className={dnsStatus === "ready" ? "text-[var(--accent-color)]" : "text-amber-400"}>
                {dnsStatus ?? "pending"}
              </span>
            </span>
            <span className="text-[var(--text-secondary)]">
              TLS:{" "}
              <span className={tlsStatus === "issued" ? "text-[var(--accent-color)]" : "text-amber-400"}>
                {tlsStatus ?? "pending"}
              </span>
            </span>
            {resolvedIps.length > 0 && (
              <span className="text-[var(--text-secondary)]">
                resolved: <span className="text-[var(--text-primary)]">{resolvedIps.join(", ")}</span>
              </span>
            )}
          </div>
          <p className="text-[10px] font-mono text-[var(--text-secondary)]/70">
            Polling every 10s. Once DNS propagates, Caddy issues a Let&apos;s Encrypt certificate automatically.
          </p>
        </div>
      )}
    </Card>
  )
}

/* ───────────── CREDENTIALS CARD ───────────── */
function CredentialsCard({
  instanceId,
  domain,
  ipAddress,
}: {
  instanceId: string
  domain: string | null
  ipAddress: string | null
}) {
  const [revealed, setRevealed] = useState<{ email: string; password: string; loginUrl: string | null } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reveal() {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/instances/${instanceId}/credentials`, { cache: "no-store" })
      const j = await r.json()
      if (!r.ok) {
        setError(j.error || "Failed to load credentials")
        return
      }
      setRevealed(j)
    } finally {
      setLoading(false)
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* ignore */
    }
  }

  const loginUrl = revealed?.loginUrl ?? (domain ? `https://${domain}` : ipAddress ? `http://${ipAddress}` : null)

  return (
    <Card title="Admin Credentials">
      {!revealed ? (
        <div className="space-y-2">
          <p className="text-sm text-[var(--text-secondary)]">
            Log into your OpenClaw agent with the auto-generated admin account.
          </p>
          <button
            onClick={reveal}
            disabled={loading}
            className="px-4 py-2 text-xs uppercase tracking-[0.08em] font-mono bg-[var(--accent-dim)] text-[var(--accent-color)] border border-[var(--accent-color)]/40 hover:bg-[var(--accent-color)]/20 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Reveal Credentials"}
          </button>
          {error && <p className="text-xs font-mono text-red-400">{error}</p>}
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <Row label="Email" value={revealed.email} onCopy={() => copy(revealed.email)} />
          <Row label="Password" value={revealed.password} onCopy={() => copy(revealed.password)} mono />
          {loginUrl && (
            <p className="text-[10px] font-mono text-[var(--text-secondary)] mt-2">
              Login at{" "}
              <a href={loginUrl} target="_blank" rel="noreferrer" className="text-[var(--accent-color)] underline">
                {loginUrl}
              </a>
            </p>
          )}
        </div>
      )}
    </Card>
  )
}

function Row({
  label,
  value,
  onCopy,
  mono,
}: {
  label: string
  value: string
  onCopy: () => void
  mono?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-[var(--text-secondary)] w-20">
        {label}
      </span>
      <span className={`flex-1 text-sm text-[var(--text-primary)] ${mono ? "font-mono" : ""} break-all`}>
        {value}
      </span>
      <button
        onClick={onCopy}
        className="px-2 py-1 text-[10px] uppercase tracking-[0.08em] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent-color)] font-mono"
      >
        Copy
      </button>
    </div>
  )
}

/* ───────────── SERVER ACCESS CARD ───────────── */
function ServerAccessCard({ instanceId, ipAddress }: { instanceId: string; ipAddress: string | null }) {
  const [revealed, setRevealed] = useState<{
    rootPassword: string | null
    sshCommand: string | null
    gatewayUrl: string | null
  } | null>(null)
  const [loading, setLoading] = useState(false)

  async function reveal() {
    setLoading(true)
    try {
      const r = await fetch(`/api/instances/${instanceId}/credentials`, { cache: "no-store" })
      const j = await r.json()
      if (r.ok) {
        setRevealed({
          rootPassword: j.rootPassword,
          sshCommand: j.sshCommand,
          gatewayUrl: j.gatewayUrl,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text) } catch { /* ignore */ }
  }

  return (
    <Card title="Server Access">
      {!revealed ? (
        <div className="space-y-2">
          <p className="text-sm text-[var(--text-secondary)]">
            SSH access and gateway URL for this server.
          </p>
          <button
            onClick={reveal}
            disabled={loading}
            className="px-4 py-2 text-xs uppercase tracking-[0.08em] font-mono bg-[var(--accent-dim)] text-[var(--accent-color)] border border-[var(--accent-color)]/40 hover:bg-[var(--accent-color)]/20 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Reveal Access Details"}
          </button>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          {revealed.sshCommand && (
            <Row label="SSH" value={revealed.sshCommand} onCopy={() => copy(revealed.sshCommand!)} mono />
          )}
          {revealed.rootPassword && (
            <Row label="Root Pass" value={revealed.rootPassword} onCopy={() => copy(revealed.rootPassword!)} mono />
          )}
          {revealed.gatewayUrl && (
            <Row label="Gateway" value={revealed.gatewayUrl} onCopy={() => copy(revealed.gatewayUrl!)} mono />
          )}
        </div>
      )}
    </Card>
  )
}

/* ───────────── PROVISIONING CARD ───────────── */
const PROVISION_STEPS = [
  // VPS path
  { match: "Creating VM", label: "Creating server" },
  { match: "Waiting for boot", label: "Booting server" },
  { match: "Cloudflare DNS upserted", label: "Setting up DNS" },
  { match: "Waiting for SSH", label: "Connecting to server" },
  { match: "Bootstrapping server", label: "Installing dependencies" },
  { match: "bootstrap complete", label: "Server ready" },
  { match: "Writing OpenClaw", label: "Writing configuration" },
  { match: "systemctl start", label: "Starting service" },
  { match: "is listening", label: "Health check passed" },
  { match: "Deployment complete", label: "Deployment complete" },
  // Shared-cluster path
  { match: "Selecting shared host", label: "Selecting host" },
  { match: "Starting bot container", label: "Starting container" },
  // Dev / mock
  { match: "Starting provisioning", label: "Initializing" },
  { match: "Mock-provisioned", label: "Provisioned" },
] as const

function useElapsedTimer(startTime: string | null, active: boolean) {
  const [elapsed, setElapsed] = useState("")
  useEffect(() => {
    if (!active || !startTime) return
    const start = new Date(startTime).getTime()
    const tick = () => {
      const s = Math.floor((Date.now() - start) / 1000)
      const m = Math.floor(s / 60)
      setElapsed(m > 0 ? `${m}m ${s % 60}s` : `${s}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startTime, active])
  return elapsed
}

function ProvisioningCard({ instance, logs }: { instance: InstanceLite; logs: LogLite[] }) {
  const logMessages = logs.map((l) => l.message)
  const isFailed = instance.status === "failed_provisioning"
  const isRunning = instance.status === "running"
  const isActive = !isFailed && !isRunning

  const earliestLog = logs.length > 0 ? logs[logs.length - 1]?.createdAt : null
  const startTime = earliestLog ?? instance.createdAt
  const elapsed = useElapsedTimer(startTime, isActive)

  const steps = PROVISION_STEPS.filter((s) =>
    logMessages.some((m) => m.includes(s.match))
  )

  const lastError = logs.find((l) => l.level === "error")

  const title = isFailed
    ? "Provisioning Failed"
    : isRunning
      ? "Provisioning Complete"
      : `Provisioning${elapsed ? ` \u00b7 ${elapsed}` : ""}`

  return (
    <Card title={title}>
      <div className="space-y-3">
        {steps.length === 0 && isActive && (
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-sm text-[var(--text-secondary)]">Preparing deployment...</span>
          </div>
        )}
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1
          const isDone = !isLast || isRunning
          return (
            <div key={step.match} className="flex items-center gap-3">
              {isDone ? (
                <span className="w-4 h-4 flex items-center justify-center text-[10px] font-bold border border-[var(--accent-color)] bg-[var(--accent-color)] text-black">
                  &#10003;
                </span>
              ) : (
                <span className="w-4 h-4 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                </span>
              )}
              <span className={`text-sm ${isDone ? "text-[var(--text-primary)]" : "text-amber-400"}`}>
                {step.label}
              </span>
            </div>
          )
        })}
        {isFailed && lastError && (
          <div className="mt-2 p-3 bg-red-500/10 border border-red-500/30">
            <p className="text-xs font-mono text-red-400">{lastError.message}</p>
          </div>
        )}
        {isRunning && (
          <p className="text-xs font-mono text-[var(--accent-color)] mt-2">
            Agent is live and ready to accept requests.
          </p>
        )}
      </div>
    </Card>
  )
}

/* ───────────── OVERVIEW ───────────── */
function OverviewTab({ instance, logs }: { instance: InstanceLite; logs: LogLite[] }) {
  const isProvisioning =
    instance.status === "pending" || instance.status === "provisioning"
  const isFailed = instance.status === "failed_provisioning"
  return (
    <div className="space-y-4 max-w-4xl">
      {(isProvisioning || (isFailed && !instance.ipAddress)) && (
        <ProvisioningCard instance={instance} logs={logs} />
      )}
      {/* DNS card only renders when a domain is explicitly configured. */}
      {instance.domain && instance.status === "running" && <DnsCard instance={instance} />}
      {instance.hasOpenclawPassword && instance.status === "running" && (
        <CredentialsCard
          instanceId={instance.id}
          domain={instance.domain}
          ipAddress={instance.ipAddress}
        />
      )}
      {instance.hasRootPassword && instance.status === "running" && (
        <ServerAccessCard instanceId={instance.id} ipAddress={instance.ipAddress} />
      )}

      <Card title="Deployment">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Status" value={instance.status} />
          <Stat label="IP" value={instance.ipAddress || "—"} />
          <Stat label="Domain" value={instance.domain || "—"} />
          <Stat
            label="TLS"
            value={instance.domain ? instance.tlsStatus ?? "pending" : "—"}
          />
        </div>
      </Card>

      <Card title="Infrastructure">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Region" value={instance.regionLabel} />
          <Stat label="Server" value={instance.serverLabel} />
          <Stat label="Specs" value={`${instance.vcpu} vCPU · ${instance.ramGb} GB`} />
          <Stat label="Created" value={new Date(instance.createdAt).toLocaleDateString()} />
        </div>
      </Card>

      <Card title="Recent Logs">
        {logs.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)]">No logs yet.</p>
        ) : (
          <div className="space-y-1.5 font-mono text-xs">
            {logs.slice(0, 8).map((l) => (
              <p key={l.id}>
                <span
                  className={
                    l.level === "error"
                      ? "text-red-400"
                      : l.level === "warn"
                      ? "text-amber-400"
                      : "text-[var(--text-secondary)]"
                  }
                >
                  [{l.level}]
                </span>{" "}
                <span className="text-[var(--text-secondary)]/60">{l.createdAt.slice(0, 19)}</span>{" "}
                <span className="text-[var(--text-primary)]">{l.message}</span>
              </p>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

/* ───────────── CONTROLS ───────────── */
function ControlsTab({ instance }: { instance: InstanceLite }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<string | null>(null)
  const [tokenRevealed, setTokenRevealed] = useState<string | null>(null)
  const [tokenLoading, setTokenLoading] = useState(false)

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  async function callAction(url: string, method: "POST" | "DELETE", label: string) {
    try {
      const r = await fetch(url, { method })
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string }
        flash(`${label} failed: ${body.error || r.statusText}`)
        return
      }
      flash(`${label} succeeded.`)
      startTransition(() => router.refresh())
    } catch (err) {
      flash(`${label} failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const isVps = instance.deploymentTarget === "vps"

  async function revealToken() {
    setTokenLoading(true)
    try {
      const endpoint = isVps
        ? `/api/instances/${instance.id}/gateway-token`
        : `/api/instances/${instance.id}/token`
      const r = await fetch(endpoint, { method: "GET" })
      const j = await r.json()
      if (!r.ok) {
        flash(j.error || "Failed to reveal token")
        return
      }
      setTokenRevealed(isVps ? j.gatewayToken : j.botToken ?? "(not yet assigned)")
    } finally {
      setTokenLoading(false)
    }
  }

  async function rotateToken() {
    if (isVps) {
      flash("Gateway token rotation is not supported yet.")
      return
    }
    setTokenLoading(true)
    try {
      const r = await fetch(`/api/instances/${instance.id}/token`, { method: "POST" })
      const j = (await r.json()) as { botToken?: string; error?: string }
      if (!r.ok) {
        flash(j.error || "Failed to rotate token")
        return
      }
      setTokenRevealed(j.botToken ?? "")
      flash("Token rotated. Container env updated.")
    } finally {
      setTokenLoading(false)
    }
  }

  async function copyToken() {
    if (!tokenRevealed) return
    try {
      await navigator.clipboard.writeText(tokenRevealed)
      flash("Token copied to clipboard.")
    } catch {
      flash("Copy failed — your browser blocked clipboard access.")
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card title="Lifecycle">
        <div className="flex flex-col gap-2">
          <button
            disabled={pending}
            onClick={() => callAction(`/api/instances/${instance.id}/restart`, "POST", "Restart")}
            className="px-4 py-2 text-xs uppercase tracking-[0.08em] bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 font-mono text-left disabled:opacity-50"
          >
            {pending ? "Working…" : "Restart Bot"}
          </button>
          <button
            disabled={pending}
            onClick={() => {
              if (!confirm("Delete this instance? This cannot be undone.")) return
              callAction(`/api/instances/${instance.id}`, "DELETE", "Delete").then(() => {
                router.push("/dashboard/instances")
              })
            }}
            className="px-4 py-2 text-xs uppercase tracking-[0.08em] bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 font-mono text-left disabled:opacity-50"
          >
            Delete Instance
          </button>
        </div>
      </Card>
      <Card title={isVps ? "Gateway Token" : "Bot Token"}>
        <p className="text-xs text-[var(--text-secondary)] mb-2">
          {isVps
            ? "Use this token to authenticate with the OpenClaw Control UI and API."
            : "API token for programmatic access to this bot."}
        </p>
        <p className="font-mono text-sm text-[var(--text-primary)] break-all bg-[var(--code-bg)] border border-[var(--border-color)] p-3">
          {tokenRevealed ?? (isVps ? "gw_•••••••••••••••••••••" : `sk_bot_•••••••••••••••••••••••••${instance.id.slice(-6)}`)}
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={revealToken}
            disabled={tokenLoading}
            className="px-3 py-1.5 text-xs uppercase tracking-[0.08em] bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--border-color)] hover:border-[var(--accent-color)] font-mono disabled:opacity-50"
          >
            {tokenLoading ? "…" : "Reveal"}
          </button>
          {!isVps && (
            <button
              onClick={rotateToken}
              disabled={tokenLoading}
              className="px-3 py-1.5 text-xs uppercase tracking-[0.08em] bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--border-color)] hover:border-[var(--accent-color)] font-mono disabled:opacity-50"
            >
              Rotate
            </button>
          )}
          {tokenRevealed && (
            <button
              onClick={copyToken}
              className="px-3 py-1.5 text-xs uppercase tracking-[0.08em] bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--border-color)] hover:border-[var(--accent-color)] font-mono"
            >
              Copy
            </button>
          )}
        </div>
      </Card>
      {isVps && <DomainManageCard instance={instance} onFlash={flash} />}
      {toast && (
        <div className="md:col-span-2 px-4 py-2 text-xs font-mono text-[var(--text-primary)] bg-[var(--card-bg)] border border-[var(--accent-color)]/40">
          {toast}
        </div>
      )}
    </div>
  )
}

/* ───────────── DOMAIN MANAGEMENT CARD ───────────── */
function DomainManageCard({
  instance,
  onFlash,
}: {
  instance: InstanceLite
  onFlash: (msg: string) => void
}) {
  const [domain, setDomain] = useState(instance.domain ?? "")
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function saveDomain() {
    setSaving(true)
    try {
      const r = await fetch(`/api/instances/${instance.id}/domain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim() || null }),
      })
      const j = await r.json()
      if (!r.ok) {
        onFlash(j.error || "Failed to update domain")
        return
      }
      onFlash(domain.trim() ? `Domain set to ${domain.trim()}. Configure DNS A record → ${instance.ipAddress}` : "Domain removed.")
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card title="Custom Domain">
      <p className="text-xs text-[var(--text-secondary)] mb-2">
        {instance.domain
          ? `Currently configured: ${instance.domain}`
          : "No custom domain. Access via IP only."}
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com"
          className="flex-1 bg-[var(--code-bg)] border border-[var(--border-color)] px-3 py-2 font-mono text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
        />
        <button
          onClick={saveDomain}
          disabled={saving}
          className="px-4 py-2 text-xs uppercase tracking-[0.08em] font-mono bg-[var(--accent-dim)] text-[var(--accent-color)] border border-[var(--accent-color)]/40 hover:bg-[var(--accent-color)]/20 disabled:opacity-50"
        >
          {saving ? "…" : "Save"}
        </button>
      </div>
      {instance.domain && instance.ipAddress && (
        <p className="text-[10px] font-mono text-[var(--text-secondary)] mt-2">
          Point <span className="text-[var(--text-primary)]">{instance.domain}</span> A record → <span className="text-[var(--accent-color)]">{instance.ipAddress}</span>
        </p>
      )}
    </Card>
  )
}

/* ───────────── INTERFACES ───────────── */
function InterfacesTab({ instance }: { instance: InstanceLite }) {
  const webUrl = instance.domain
    ? `${instance.tlsStatus === "issued" ? "https" : "http"}://${instance.domain}`
    : instance.ipAddress
    ? `http://${instance.ipAddress}`
    : null
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card title="Web">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.08em] font-mono px-2 py-0.5 border border-[var(--accent-color)]/40 text-[var(--accent-color)] bg-[var(--accent-dim)]">
            {instance.status === "running" ? "bound" : instance.status}
          </span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-3 font-mono break-all">
          {webUrl ?? "—"}
        </p>
      </Card>
      <Card title="Telegram">
        <p className="text-xs text-[var(--text-secondary)]">
          Bind a Telegram bot token to route Telegram DMs to this agent.
        </p>
        <p className="text-[10px] font-mono text-[var(--text-secondary)]/70 mt-3">
          Use <span className="text-[var(--text-primary)]">POST /api/instances/{instance.id.slice(0, 8)}…/interfaces/connect</span>
        </p>
      </Card>
    </div>
  )
}

/* ───────────── LOGS ───────────── */
function LogsTab({ logs }: { logs: LogLite[] }) {
  const [level, setLevel] = useState<"all" | "info" | "warn" | "error">("all")
  const filtered = logs.filter((l) => level === "all" || l.level === level)
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {(["all", "info", "warn", "error"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.08em] font-mono border ${
              level === l
                ? "border-[var(--accent-color)] text-[var(--accent-color)] bg-[var(--accent-dim)]"
                : "border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--accent-color)]"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="border border-[var(--border-color)] bg-black/60 p-4 font-mono text-xs space-y-1 max-h-[28rem] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-[var(--text-secondary)]">No log entries.</p>
        ) : (
          filtered.map((l) => (
            <p key={l.id}>
              <span className="text-[var(--text-secondary)]/60">{l.createdAt.slice(0, 19)}</span>{" "}
              <span
                className={
                  l.level === "error"
                    ? "text-red-400"
                    : l.level === "warn"
                    ? "text-amber-400"
                    : "text-[var(--accent-color)]"
                }
              >
                [{l.level}]
              </span>{" "}
              <span className="text-[var(--text-primary)]">{l.message}</span>
            </p>
          ))
        )}
      </div>
    </div>
  )
}

/* ───────────── DANGER ZONE ───────────── */
function DangerTab({ instance }: { instance: InstanceLite }) {
  const router = useRouter()
  const [confirmText, setConfirmText] = useState("")
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const matches = confirmText === instance.name

  async function doDelete() {
    setDeleting(true)
    setError(null)
    try {
      const r = await fetch(`/api/instances/${instance.id}`, { method: "DELETE" })
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string }
        setError(body.error || r.statusText)
        setDeleting(false)
        return
      }
      router.push("/dashboard/instances")
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="border border-red-500/30 bg-red-500/5 p-5">
        <p className="text-[10px] uppercase tracking-[0.1em] font-mono text-red-400 mb-3">
          Delete Instance
        </p>
        <p className="text-sm text-[var(--text-secondary)] mb-3">
          Permanently deletes this bot, its config, logs, and all associated data. Also destroys the Linode VPS. This cannot be undone.
        </p>
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            className="px-4 py-2 text-xs uppercase tracking-[0.08em] font-mono bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
          >
            Delete Instance
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-mono text-[var(--text-secondary)]">
              Type <span className="text-red-400">{instance.name}</span> to confirm:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] px-3 py-2 font-mono text-sm text-[var(--text-primary)] focus:outline-none focus:border-red-500/50"
            />
            <div className="flex gap-2">
              <button
                disabled={!matches || deleting}
                onClick={doDelete}
                className="px-4 py-2 text-xs uppercase tracking-[0.08em] font-mono bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? "Deleting…" : "I understand, delete"}
              </button>
              <button
                disabled={deleting}
                onClick={() => {
                  setOpen(false)
                  setConfirmText("")
                  setError(null)
                }}
                className="px-4 py-2 text-xs uppercase tracking-[0.08em] font-mono border border-[var(--border-color)] text-[var(--text-primary)]"
              >
                Cancel
              </button>
            </div>
            {error && <p className="text-xs font-mono text-red-400">Delete failed: {error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
