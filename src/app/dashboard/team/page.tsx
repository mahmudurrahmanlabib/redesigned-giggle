import { auth } from "@/auth"
import { redirect } from "next/navigation"

type Member = {
  email: string
  role: "owner" | "admin" | "developer" | "viewer"
  status: "active" | "invited"
  lastSeen: string
}

const MEMBERS: Member[] = [
  { email: "you@acme.com", role: "owner", status: "active", lastSeen: "now" },
  { email: "alice@acme.com", role: "admin", status: "active", lastSeen: "12 min ago" },
  { email: "bob@acme.com", role: "developer", status: "active", lastSeen: "2 days ago" },
  { email: "external@vendor.com", role: "viewer", status: "invited", lastSeen: "pending" },
]

const ROLE_STYLES: Record<Member["role"], string> = {
  owner: "text-[var(--accent-color)] border-[var(--accent-color)]/40 bg-[var(--accent-dim)]",
  admin: "text-amber-400 border-amber-500/40 bg-amber-500/5",
  developer: "text-[var(--text-primary)] border-[var(--border-color)] bg-[var(--card-bg)]",
  viewer: "text-[var(--text-secondary)] border-[var(--border-color)] bg-[var(--card-bg)]",
}

export default async function TeamPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1
            className="text-2xl font-bold uppercase tracking-[0.02em] text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Team
          </h1>
          <p className="text-[var(--text-secondary)] mt-1 text-sm">
            Invite teammates and control their access per agent.
          </p>
        </div>
        <button className="btn-primary text-sm px-5 py-2.5">
          + Invite Member
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
          <p className="text-[10px] uppercase tracking-[0.1em] font-mono text-[var(--text-secondary)]">Plan</p>
          <p className="text-2xl font-bold text-[var(--text-primary)] font-mono mt-2">Pro</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">Up to 5 seats</p>
        </div>
        <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
          <p className="text-[10px] uppercase tracking-[0.1em] font-mono text-[var(--text-secondary)]">Seats Used</p>
          <p className="text-2xl font-bold text-[var(--accent-color)] font-mono mt-2">{MEMBERS.length} / 5</p>
        </div>
        <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
          <p className="text-[10px] uppercase tracking-[0.1em] font-mono text-[var(--text-secondary)]">Pending Invites</p>
          <p className="text-2xl font-bold text-[var(--text-primary)] font-mono mt-2">
            {MEMBERS.filter((m) => m.status === "invited").length}
          </p>
        </div>
      </div>

      <div className="border border-[var(--border-color)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-secondary)] font-mono border-b border-[var(--border-color)]">
              <th className="text-left px-4 py-3">Member</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Last Seen</th>
              <th className="text-right px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {MEMBERS.map((m) => (
              <tr key={m.email} className="border-b border-[var(--border-color)]/50">
                <td className="px-4 py-3 text-[var(--text-primary)]">{m.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] uppercase tracking-[0.08em] font-mono px-2 py-0.5 border ${ROLE_STYLES[m.role]}`}>
                    {m.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{m.status}</td>
                <td className="px-4 py-3 text-xs font-mono text-[var(--text-secondary)]">{m.lastSeen}</td>
                <td className="px-4 py-3 text-right">
                  {m.role !== "owner" && (
                    <button className="text-xs uppercase tracking-[0.08em] font-mono text-red-400 hover:underline">
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-5">
        <p className="text-[10px] uppercase tracking-[0.1em] font-mono text-[var(--text-secondary)] mb-3">
          Roles
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-[var(--text-secondary)]">
          <div><span className="text-[var(--accent-color)] font-mono">owner</span> — full access incl. billing</div>
          <div><span className="text-amber-400 font-mono">admin</span> — manage agents, team, settings (no billing)</div>
          <div><span className="text-[var(--text-primary)] font-mono">developer</span> — deploy, restart, edit agents</div>
          <div><span className="text-[var(--text-secondary)] font-mono">viewer</span> — read-only dashboards and logs</div>
        </div>
      </div>

      <p className="text-[10px] font-mono text-amber-400/80">
        ⚠ dummy roster — Team / Membership / Invite models + RBAC pending
      </p>
    </div>
  )
}
