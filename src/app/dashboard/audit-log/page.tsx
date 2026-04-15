import { auth } from "@/auth"
import { redirect } from "next/navigation"

type AuditEvent = {
  id: string
  at: string
  actor: string
  action: string
  target: string
  ip: string
}

const EVENTS: AuditEvent[] = [
  { id: "1", at: "2026-04-15 12:04:18", actor: "you", action: "instance.deploy", target: "support-agent", ip: "73.12.44.201" },
  { id: "2", at: "2026-04-15 11:58:02", actor: "you", action: "api_key.create", target: "Production", ip: "73.12.44.201" },
  { id: "3", at: "2026-04-14 19:11:39", actor: "you", action: "instance.restart", target: "sales-sdr-v2", ip: "73.12.44.201" },
  { id: "4", at: "2026-04-14 09:42:03", actor: "you", action: "billing.subscription.upgrade", target: "pro", ip: "73.12.44.201" },
  { id: "5", at: "2026-04-13 22:17:55", actor: "teammate@acme.com", action: "instance.delete", target: "test-bot-3", ip: "77.88.12.3" },
  { id: "6", at: "2026-04-12 14:02:11", actor: "you", action: "account.login", target: "email+password", ip: "73.12.44.201" },
  { id: "7", at: "2026-04-11 08:33:47", actor: "you", action: "skill.install", target: "faq_handler@support-agent", ip: "73.12.44.201" },
]

const ACTION_STYLES: Record<string, string> = {
  "instance.deploy": "text-[var(--accent-color)]",
  "instance.delete": "text-red-400",
  "instance.restart": "text-amber-400",
  "api_key.create": "text-[var(--accent-color)]",
  "billing.subscription.upgrade": "text-[var(--accent-color)]",
  "account.login": "text-[var(--text-secondary)]",
  "skill.install": "text-[var(--accent-color)]",
}

export default async function AuditLogPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1
          className="text-2xl font-bold uppercase tracking-[0.02em] text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Audit Log
        </h1>
        <p className="text-[var(--text-secondary)] mt-1 text-sm">
          Every action taken on your account. Retained for 90 days (Pro) / 365 days (Enterprise).
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["All", "Instances", "Billing", "Auth", "Keys", "Skills"].map((t, i) => (
          <button
            key={t}
            className={`px-3 py-1.5 text-xs uppercase tracking-[0.08em] font-mono border ${
              i === 0
                ? "border-[var(--accent-color)] text-[var(--accent-color)] bg-[var(--accent-dim)]"
                : "border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="border border-[var(--border-color)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-secondary)] font-mono border-b border-[var(--border-color)]">
              <th className="text-left px-4 py-3">Time</th>
              <th className="text-left px-4 py-3">Actor</th>
              <th className="text-left px-4 py-3">Action</th>
              <th className="text-left px-4 py-3">Target</th>
              <th className="text-right px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {EVENTS.map((e) => (
              <tr key={e.id} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--accent-dim)]/10">
                <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">{e.at}</td>
                <td className="px-4 py-3 text-[var(--text-primary)]">{e.actor}</td>
                <td className={`px-4 py-3 font-mono text-xs ${ACTION_STYLES[e.action] || "text-[var(--text-primary)]"}`}>
                  {e.action}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--text-primary)]">{e.target}</td>
                <td className="px-4 py-3 font-mono text-xs text-right text-[var(--text-secondary)]">{e.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] font-mono text-amber-400/80">
        ⚠ dummy events — AuditEvent model + writer middleware pending
      </p>
    </div>
  )
}
