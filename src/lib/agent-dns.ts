import {
  upsertDnsRecord,
  deleteDnsRecord,
  findRecordByName,
  type CloudflareError,
} from "./cloudflare"

const BASE = process.env.CLOUDFLARE_BASE_DOMAIN ?? "sovereignclaw.xyz"

export const agentHostname = (agentId: string): string => `${agentId}.${BASE}`

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export type AgentDnsResult = { name: string; recordId: string }

export async function createAgentSubdomain(
  agentId: string,
  ip: string,
  opts: { proxied?: boolean } = {},
): Promise<AgentDnsResult> {
  const name = agentHostname(agentId)
  const proxied = opts.proxied ?? true
  const max = 6
  let lastErr: unknown
  for (let attempt = 0; attempt < max; attempt++) {
    try {
      const rec = await upsertDnsRecord({ name, ip, proxied })
      return { name, recordId: rec.id }
    } catch (e) {
      lastErr = e
      const cfErr = e as CloudflareError
      // Don't retry hard auth/permission errors
      if (cfErr.status === 401 || cfErr.status === 403) throw e
      const wait = cfErr.retryAfter
        ? cfErr.retryAfter * 1000
        : Math.min(30_000, 500 * 2 ** attempt) + Math.random() * 250
      if (attempt === max - 1) break
      await sleep(wait)
    }
  }
  throw lastErr ?? new Error("createAgentSubdomain: exhausted retries")
}

export async function deleteAgentSubdomain(
  agentId: string,
  recordId?: string | null,
): Promise<void> {
  if (recordId) {
    try {
      await deleteDnsRecord(recordId)
      return
    } catch (e) {
      const cfErr = e as CloudflareError
      if (cfErr.status !== 404) throw e
      // fall through to lookup-by-name in case the stored ID is stale
    }
  }
  const rec = await findRecordByName(agentHostname(agentId))
  if (rec) await deleteDnsRecord(rec.id)
}
