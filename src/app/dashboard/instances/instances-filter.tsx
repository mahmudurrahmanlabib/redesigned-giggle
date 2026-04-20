"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  running: "bg-[var(--accent-dim)] text-[var(--accent-color)] border-[var(--accent-color)]/30",
  provisioning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  stopped: "bg-[var(--card-bg)] text-[var(--text-secondary)] border-[var(--border-color)]",
  failed_provisioning: "bg-red-500/10 text-red-400 border-red-500/30",
  deleting: "bg-zinc-800/20 text-zinc-400 border-zinc-800/30",
}

type Item = {
  id: string
  name: string
  slug: string
  status: string
  ipAddress: string | null
  regionLabel: string
  serverLabel: string
  vcpu: number
  ramGb: number
  recentLogs: { id: string; level: string; message: string; createdAt: string }[]
}

const FILTERS = [
  "all",
  "running",
  "provisioning",
  "stopped",
  "failed_provisioning",
  "deleting",
] as const
type Filter = (typeof FILTERS)[number]

export function InstancesFilter({ items: initialItems }: { items: Item[] }) {
  const [items, setItems] = useState(initialItems)
  const [q, setQ] = useState("")
  const [status, setStatus] = useState<Filter>("all")

  const hasProvisioning = items.some(
    (i) => i.status === "pending" || i.status === "provisioning" || i.status === "deleting",
  )

  useEffect(() => {
    if (!hasProvisioning) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    async function poll() {
      try {
        const r = await fetch("/api/instances", { cache: "no-store" })
        if (!r.ok || cancelled) return
        const rows = await r.json()
        setItems((prev) =>
          prev.map((item) => {
            const updated = rows.find((r: { id: string }) => r.id === item.id)
            if (!updated) return item
            return {
              ...item,
              status: updated.status,
              ipAddress: updated.ipAddress,
            }
          })
        )
      } catch {
        /* retry next interval */
      }
      if (!cancelled) {
        timer = setTimeout(poll, 5_000)
      }
    }

    timer = setTimeout(poll, 3_000)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [hasProvisioning])

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        if (status !== "all" && i.status !== status) return false
        if (q && !`${i.name} ${i.slug}`.toLowerCase().includes(q.toLowerCase())) return false
        return true
      }),
    [items, q, status]
  )

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or slug..."
          className="flex-1 min-w-[16rem] bg-[var(--card-bg)] border border-[var(--border-color)] px-3 py-2 text-sm font-mono text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-color)]"
        />
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatus(f)}
              className={`px-3 py-2 text-[10px] uppercase tracking-[0.08em] font-mono border ${
                status === f
                  ? "border-[var(--accent-color)] text-[var(--accent-color)] bg-[var(--accent-dim)]"
                  : "border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--accent-color)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <p className="text-[10px] font-mono text-[var(--text-secondary)] ml-auto">
          {filtered.length} / {items.length}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-12 text-center">
          <p className="text-[var(--text-secondary)]">No matches.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((instance) => (
            <Link
              key={instance.id}
              href={`/dashboard/instances/${instance.id}`}
              className="block border border-[var(--border-color)] bg-[var(--card-bg)] p-6 space-y-4 hover:border-[var(--accent-color)] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3
                      className="text-lg font-bold uppercase tracking-[0.02em] text-[var(--text-primary)]"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {instance.name}
                    </h3>
                    <Badge className={STATUS_STYLES[instance.status] || STATUS_STYLES.stopped}>
                      {instance.status}
                    </Badge>
                    {(instance.status === "provisioning" ||
                      instance.status === "pending" ||
                      instance.status === "deleting") && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 font-mono">
                    {instance.slug}
                    {instance.ipAddress && (
                      <>
                        {" · "}
                        <span className="text-[var(--accent-color)]">
                          {instance.ipAddress}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <span className="text-xs text-[var(--text-secondary)] font-mono">→ Manage</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
                {[
                  { label: "Region", value: instance.regionLabel },
                  { label: "Server", value: instance.serverLabel },
                  { label: "Specs", value: `${instance.vcpu} vCPU · ${instance.ramGb} GB` },
                  { label: "IP", value: instance.ipAddress || "Pending", mono: true },
                ].map((d) => (
                  <div key={d.label} className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3">
                    <p className="text-[var(--text-secondary)] text-xs uppercase tracking-[0.1em] font-mono">
                      {d.label}
                    </p>
                    <p className={`text-[var(--text-primary)] mt-0.5 text-sm ${d.mono ? "font-mono text-xs" : ""}`}>
                      {d.value}
                    </p>
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
