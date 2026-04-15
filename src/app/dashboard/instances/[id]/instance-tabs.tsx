"use client"

import { useState } from "react"
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
  gatewayUrl: string
}

type LogLite = { id: string; level: string; message: string; createdAt: string }

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "controls", label: "Controls" },
  { id: "ai-config", label: "AI Config" },
  { id: "interfaces", label: "Interfaces" },
  { id: "skills", label: "Skills" },
  { id: "monitoring", label: "Monitoring" },
  { id: "logs", label: "Logs" },
  { id: "webhooks", label: "Webhooks" },
  { id: "env", label: "Env Vars" },
  { id: "usage", label: "Usage" },
  { id: "danger", label: "Danger Zone" },
] as const

export function InstanceTabs({
  active,
  instance,
  logs,
}: {
  active: string
  instance: InstanceLite
  logs: LogLite[]
}) {
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
      {active === "ai-config" && <AiConfigTab />}
      {active === "interfaces" && <InterfacesTab instance={instance} />}
      {active === "skills" && <SkillsTab />}
      {active === "monitoring" && <MonitoringTab instance={instance} />}
      {active === "logs" && <LogsTab />}
      {active === "webhooks" && <WebhooksTab />}
      {active === "env" && <EnvTab />}
      {active === "usage" && <UsageTab />}
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

function Dummy({ note }: { note?: string }) {
  return (
    <p className="text-xs text-amber-400/80 font-mono mt-2">
      ⚠ dummy data — backend not wired yet{note ? ` · ${note}` : ""}
    </p>
  )
}

/* ───────────── OVERVIEW ───────────── */
function OverviewTab({ instance, logs }: { instance: InstanceLite; logs: LogLite[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card title="Health">
          <div className="grid grid-cols-4 gap-4">
            <Stat label="Status" value={instance.status} />
            <Stat label="Uptime 24h" value="99.9%" />
            <Stat label="Uptime 7d" value="99.7%" />
            <Stat label="Last Heartbeat" value="2s ago" />
          </div>
          <Dummy note="Uptime Kuma integration pending" />
        </Card>

        <Card title="Infrastructure">
          <div className="grid grid-cols-4 gap-4">
            <Stat label="Region" value={instance.regionLabel} />
            <Stat label="Server" value={instance.serverLabel} />
            <Stat label="Specs" value={`${instance.vcpu} vCPU · ${instance.ramGb} GB`} />
            <Stat label="IP" value={instance.ipAddress || "—"} />
          </div>
        </Card>

        <Card title="Recent Logs">
          {logs.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)]">No logs yet.</p>
          ) : (
            <div className="space-y-1.5 font-mono text-xs">
              {logs.map((l) => (
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

      <div className="space-y-4">
        <Card title="Credits">
          <p className="text-3xl font-bold text-[var(--accent-color)] font-mono">12,480</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">~3.2k requests remaining at current burn</p>
          <Dummy />
        </Card>
        <Card title="Quick Info">
          <Stat label="Created" value={new Date(instance.createdAt).toLocaleDateString()} />
          <div className="mt-3">
            <Stat label="Gateway" value={instance.gatewayUrl.replace("https://", "")} />
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ───────────── CONTROLS ───────────── */
function ControlsTab({ instance }: { instance: InstanceLite }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card title="Lifecycle">
        <div className="flex flex-col gap-2">
          <button className="px-4 py-2 text-xs uppercase tracking-[0.08em] bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 font-mono text-left">
            Restart Bot
          </button>
          <button className="px-4 py-2 text-xs uppercase tracking-[0.08em] bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--border-color)] hover:border-[var(--accent-color)] font-mono text-left">
            Stop
          </button>
          <button className="px-4 py-2 text-xs uppercase tracking-[0.08em] bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 font-mono text-left">
            Delete Instance
          </button>
        </div>
        <Dummy />
      </Card>
      <Card title="Bot Token">
        <p className="font-mono text-sm text-[var(--text-primary)] break-all bg-[var(--code-bg)] border border-[var(--border-color)] p-3">
          sk_bot_•••••••••••••••••••••••••{instance.id.slice(-6)}
        </p>
        <div className="flex gap-2 mt-3">
          <button className="px-3 py-1.5 text-xs uppercase tracking-[0.08em] bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--border-color)] hover:border-[var(--accent-color)] font-mono">
            Reveal
          </button>
          <button className="px-3 py-1.5 text-xs uppercase tracking-[0.08em] bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--border-color)] hover:border-[var(--accent-color)] font-mono">
            Rotate
          </button>
        </div>
        <Dummy />
      </Card>
    </div>
  )
}

/* ───────────── AI CONFIG ───────────── */
function AiConfigTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card title="Model">
        <Stat label="Provider" value="Anthropic" />
        <div className="mt-3">
          <Stat label="Model" value="claude-opus-4-6" />
        </div>
        <div className="mt-3">
          <Stat label="Tier" value="high" />
        </div>
        <div className="mt-3">
          <Stat label="Fallback" value="openai/gpt-4.1" />
        </div>
        <Dummy />
      </Card>
      <Card title="Parameters">
        <Stat label="Temperature" value="0.7" />
        <div className="mt-3">
          <Stat label="Max Tokens" value="4096" />
        </div>
        <div className="mt-3">
          <Stat label="Rate Limit" value="60 req/min" />
        </div>
        <Dummy />
      </Card>
      <div className="md:col-span-2">
        <Card title="SOUL.md">
          <pre className="font-mono text-xs text-[var(--text-secondary)] whitespace-pre-wrap bg-[var(--code-bg)] border border-[var(--border-color)] p-4">
{`# Identity: Support Agent
# Role: Serve SaaS customers
# Tone: friendly
# Task Focus:
  - Ticket triage & routing
  - FAQ auto-response
# Constraints: no external network, english-only`}
          </pre>
          <Dummy note="editor pending" />
        </Card>
      </div>
    </div>
  )
}

/* ───────────── INTERFACES ───────────── */
function InterfacesTab({ instance }: { instance: InstanceLite }) {
  const ifaces = [
    { kind: "web", label: "Web Widget", status: "bound", hint: instance.gatewayUrl },
    { kind: "telegram", label: "Telegram", status: "deferred", hint: "Not connected" },
    { kind: "discord", label: "Discord", status: "not-configured", hint: "Not configured" },
    { kind: "slack", label: "Slack", status: "not-configured", hint: "Not configured" },
    { kind: "api", label: "REST API", status: "bound", hint: `${instance.gatewayUrl}/v1` },
  ]
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {ifaces.map((i) => (
        <Card key={i.kind} title={i.label}>
          <div className="flex items-center justify-between">
            <span
              className={`text-xs uppercase tracking-[0.08em] font-mono px-2 py-0.5 border ${
                i.status === "bound"
                  ? "border-[var(--accent-color)]/40 text-[var(--accent-color)] bg-[var(--accent-dim)]"
                  : i.status === "deferred"
                  ? "border-amber-500/40 text-amber-400 bg-amber-500/5"
                  : "border-[var(--border-color)] text-[var(--text-secondary)]"
              }`}
            >
              {i.status}
            </span>
            <button className="text-xs uppercase tracking-[0.08em] font-mono text-[var(--accent-color)] hover:underline">
              {i.status === "bound" ? "Reconfigure" : "Connect"}
            </button>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-3 font-mono break-all">{i.hint}</p>
        </Card>
      ))}
      <div className="md:col-span-2">
        <Dummy note="interface binding API pending" />
      </div>
    </div>
  )
}

/* ───────────── SKILLS ───────────── */
function SkillsTab() {
  const skills = [
    { id: "faq_handler", name: "FAQ Handler", desc: "Match queries against a knowledge base.", installed: true, deps: [] },
    { id: "ticket_router", name: "Ticket Router", desc: "Classify and route support tickets.", installed: true, deps: ["faq_handler"] },
    { id: "lead_capture", name: "Lead Capture", desc: "Qualify leads and push to CRM.", installed: false, deps: [] },
    { id: "code_generator", name: "Code Generator", desc: "Produce code snippets on demand.", installed: false, deps: [] },
    { id: "log_analyzer", name: "Log Analyzer", desc: "Summarize error logs and flag anomalies.", installed: false, deps: [] },
    { id: "web_search", name: "Web Search", desc: "Live web retrieval via SearXNG.", installed: false, deps: [] },
  ]
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">Marketplace · browse and install skills</p>
        <input
          type="text"
          placeholder="Search skills..."
          className="bg-[var(--card-bg)] border border-[var(--border-color)] px-3 py-1.5 text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-color)]"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {skills.map((s) => (
          <div key={s.id} className="border border-[var(--border-color)] bg-[var(--card-bg)] p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{s.name}</p>
                <p className="text-[10px] font-mono text-[var(--text-secondary)]">{s.id}</p>
              </div>
              {s.installed && (
                <span className="text-[10px] uppercase tracking-[0.08em] font-mono text-[var(--accent-color)] border border-[var(--accent-color)]/40 px-1.5 py-0.5">
                  installed
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-secondary)]">{s.desc}</p>
            {s.deps.length > 0 && (
              <p className="text-[10px] font-mono text-[var(--text-secondary)]">
                requires: {s.deps.join(", ")}
              </p>
            )}
            <button
              className={`w-full text-xs uppercase tracking-[0.08em] font-mono px-3 py-1.5 border ${
                s.installed
                  ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                  : "border-[var(--accent-color)] text-[var(--accent-color)] hover:bg-[var(--accent-dim)]"
              }`}
            >
              {s.installed ? "Uninstall" : "Install"}
            </button>
          </div>
        ))}
      </div>
      <Dummy note="skill registry DB pending" />
    </div>
  )
}

/* ───────────── MONITORING ───────────── */
function MonitoringTab({ instance }: { instance: InstanceLite }) {
  return (
    <div className="space-y-4">
      <Card title="Uptime Kuma">
        <p className="text-sm text-[var(--text-secondary)]">
          Health probes and uptime history will be served by our Uptime Kuma cluster, then exposed here via API.
        </p>
        <div className="mt-4 grid grid-cols-4 gap-4">
          <Stat label="Status" value={instance.status === "running" ? "Up" : "Down"} />
          <Stat label="Last Check" value="12s ago" />
          <Stat label="Avg Latency" value="142 ms" />
          <Stat label="Incidents 7d" value="0" />
        </div>
        <Dummy note="Uptime Kuma API integration pending" />
      </Card>

      <Card title="24h Uptime">
        <div className="h-24 flex items-end gap-0.5">
          {Array.from({ length: 48 }).map((_, i) => {
            const h = 60 + ((i * 37) % 40)
            return (
              <div
                key={i}
                className="flex-1 bg-[var(--accent-color)]/60"
                style={{ height: `${h}%` }}
              />
            )
          })}
        </div>
        <p className="text-[10px] font-mono text-[var(--text-secondary)] mt-2">
          48 buckets · 30 min each · dummy visualization
        </p>
      </Card>

      <Card title="Probes">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-[var(--text-secondary)] border-b border-[var(--border-color)]">
              <th className="text-left py-2">Time</th>
              <th className="text-left py-2">Result</th>
              <th className="text-right py-2">Latency</th>
            </tr>
          </thead>
          <tbody className="text-[var(--text-primary)]">
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-[var(--border-color)]/50">
                <td className="py-1.5 text-[var(--text-secondary)]">—</td>
                <td className="py-1.5 text-[var(--accent-color)]">200 OK</td>
                <td className="py-1.5 text-right">{120 + i * 7} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Dummy />
      </Card>
    </div>
  )
}

/* ───────────── LOGS ───────────── */
function LogsTab() {
  const [level, setLevel] = useState<"all" | "info" | "warn" | "error">("all")
  const lines = [
    { t: "12:04:21", lvl: "info", msg: "GET /v1/chat 200 · 142ms" },
    { t: "12:04:12", lvl: "info", msg: "Session started · user=u_a1b2" },
    { t: "12:03:55", lvl: "warn", msg: "Rate limit approaching: 54/60" },
    { t: "12:03:41", lvl: "info", msg: "Skill faq_handler matched" },
    { t: "12:03:20", lvl: "error", msg: "Upstream 502 from provider · retrying" },
    { t: "12:03:02", lvl: "info", msg: "Heartbeat OK" },
    { t: "12:02:47", lvl: "info", msg: "POST /v1/complete 200 · 890ms" },
  ].filter((l) => level === "all" || l.lvl === level)
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
        <div className="ml-auto flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-color)] animate-pulse" />
          <span className="text-[10px] font-mono text-[var(--text-secondary)]">streaming · dummy</span>
        </div>
      </div>
      <div className="border border-[var(--border-color)] bg-black/60 p-4 font-mono text-xs space-y-1 max-h-[28rem] overflow-y-auto">
        {lines.map((l, i) => (
          <p key={i}>
            <span className="text-[var(--text-secondary)]/60">{l.t}</span>{" "}
            <span
              className={
                l.lvl === "error"
                  ? "text-red-400"
                  : l.lvl === "warn"
                  ? "text-amber-400"
                  : "text-[var(--accent-color)]"
              }
            >
              [{l.lvl}]
            </span>{" "}
            <span className="text-[var(--text-primary)]">{l.msg}</span>
          </p>
        ))}
      </div>
      <Dummy note="log streaming WS pending" />
    </div>
  )
}

/* ───────────── WEBHOOKS ───────────── */
function WebhooksTab() {
  const [hooks, setHooks] = useState([
    { id: "wh_1", url: "https://api.acme.com/bot-events", events: ["message.created", "incident.opened"], active: true },
    { id: "wh_2", url: "https://hooks.slack.com/services/T0/B0/xxx", events: ["incident.opened"], active: false },
  ])
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">Receive events over HTTPS. Signed with your bot token.</p>
        <button className="btn-primary text-xs px-4 py-2">+ Add Webhook</button>
      </div>
      <div className="border border-[var(--border-color)]">
        {hooks.map((h, i) => (
          <div
            key={h.id}
            className={`p-4 flex items-center justify-between gap-4 ${i > 0 ? "border-t border-[var(--border-color)]" : ""}`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs text-[var(--text-primary)] truncate">{h.url}</p>
              <p className="text-[10px] font-mono text-[var(--text-secondary)] mt-1">
                events: {h.events.join(", ")}
              </p>
            </div>
            <span
              className={`text-[10px] uppercase tracking-[0.08em] font-mono px-2 py-0.5 border ${
                h.active
                  ? "border-[var(--accent-color)]/40 text-[var(--accent-color)] bg-[var(--accent-dim)]"
                  : "border-[var(--border-color)] text-[var(--text-secondary)]"
              }`}
            >
              {h.active ? "active" : "paused"}
            </span>
            <button
              onClick={() => setHooks(hooks.map((x) => (x.id === h.id ? { ...x, active: !x.active } : x)))}
              className="text-xs uppercase tracking-[0.08em] font-mono text-[var(--accent-color)] hover:underline"
            >
              {h.active ? "Pause" : "Resume"}
            </button>
            <button
              onClick={() => setHooks(hooks.filter((x) => x.id !== h.id))}
              className="text-xs uppercase tracking-[0.08em] font-mono text-red-400 hover:underline"
            >
              Delete
            </button>
          </div>
        ))}
        {hooks.length === 0 && (
          <p className="text-sm text-[var(--text-secondary)] p-6 text-center">No webhooks yet.</p>
        )}
      </div>
      <Dummy note="webhook delivery worker pending" />
    </div>
  )
}

/* ───────────── ENV VARS ───────────── */
function EnvTab() {
  const [vars, setVars] = useState([
    { key: "OPENAI_API_KEY", value: "sk-•••••••••••••xyz", secret: true },
    { key: "SLACK_WEBHOOK_URL", value: "https://hooks.slack.com/•••", secret: true },
    { key: "LOG_LEVEL", value: "info", secret: false },
  ])
  const [showKey, setShowKey] = useState<string | null>(null)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">Injected into the bot runtime at startup.</p>
        <button className="btn-primary text-xs px-4 py-2">+ Add Variable</button>
      </div>
      <div className="border border-[var(--border-color)]">
        {vars.map((v, i) => (
          <div
            key={v.key}
            className={`p-3 flex items-center gap-3 ${i > 0 ? "border-t border-[var(--border-color)]" : ""}`}
          >
            <p className="font-mono text-xs text-[var(--accent-color)] min-w-[14rem]">{v.key}</p>
            <p className="font-mono text-xs text-[var(--text-primary)] flex-1 truncate">
              {v.secret && showKey !== v.key ? "••••••••••••" : v.value}
            </p>
            {v.secret && (
              <button
                onClick={() => setShowKey(showKey === v.key ? null : v.key)}
                className="text-[10px] uppercase tracking-[0.08em] font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                {showKey === v.key ? "Hide" : "Reveal"}
              </button>
            )}
            <button
              onClick={() => setVars(vars.filter((x) => x.key !== v.key))}
              className="text-[10px] uppercase tracking-[0.08em] font-mono text-red-400 hover:underline"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
      <p className="text-[10px] font-mono text-[var(--text-secondary)]">
        Changes apply on next restart.
      </p>
      <Dummy note="encrypted env store pending" />
    </div>
  )
}

/* ───────────── DANGER ZONE ───────────── */
function DangerTab({ instance }: { instance: InstanceLite }) {
  const [confirmText, setConfirmText] = useState("")
  const [open, setOpen] = useState(false)
  const matches = confirmText === instance.name
  return (
    <div className="space-y-4">
      <Card title="Transfer Ownership">
        <p className="text-sm text-[var(--text-secondary)] mb-3">
          Move this agent to another user in your org. They take billing responsibility.
        </p>
        <button className="px-4 py-2 text-xs uppercase tracking-[0.08em] font-mono border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent-color)]">
          Transfer
        </button>
        <Dummy />
      </Card>
      <div className="border border-red-500/30 bg-red-500/5 p-5">
        <p className="text-[10px] uppercase tracking-[0.1em] font-mono text-red-400 mb-3">
          Delete Instance
        </p>
        <p className="text-sm text-[var(--text-secondary)] mb-3">
          Permanently deletes this bot, its config, logs, and all associated data. This cannot be undone.
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
                disabled={!matches}
                className="px-4 py-2 text-xs uppercase tracking-[0.08em] font-mono bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                I understand, delete
              </button>
              <button
                onClick={() => {
                  setOpen(false)
                  setConfirmText("")
                }}
                className="px-4 py-2 text-xs uppercase tracking-[0.08em] font-mono border border-[var(--border-color)] text-[var(--text-primary)]"
              >
                Cancel
              </button>
            </div>
            <Dummy note="delete API pending" />
          </div>
        )}
      </div>
    </div>
  )
}

/* ───────────── USAGE ───────────── */
function UsageTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Credits Remaining">
          <p className="text-3xl font-bold text-[var(--accent-color)] font-mono">12,480</p>
        </Card>
        <Card title="Used This Period">
          <p className="text-3xl font-bold text-[var(--text-primary)] font-mono">7,520</p>
        </Card>
        <Card title="Plan Limit">
          <p className="text-3xl font-bold text-[var(--text-primary)] font-mono">20,000</p>
        </Card>
      </div>
      <Card title="Recent Requests">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-[var(--text-secondary)] border-b border-[var(--border-color)]">
              <th className="text-left py-2">Time</th>
              <th className="text-left py-2">Kind</th>
              <th className="text-right py-2">Tokens</th>
              <th className="text-right py-2">Credits</th>
            </tr>
          </thead>
          <tbody className="text-[var(--text-primary)]">
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-b border-[var(--border-color)]/50">
                <td className="py-1.5 text-[var(--text-secondary)]">—</td>
                <td className="py-1.5">request</td>
                <td className="py-1.5 text-right">{800 + i * 40}</td>
                <td className="py-1.5 text-right text-[var(--accent-color)]">{i + 1}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Dummy />
      </Card>
    </div>
  )
}
