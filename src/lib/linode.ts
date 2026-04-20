import {
  createLinode,
  deleteLinode,
  getLinode,
  getLinodes,
  setToken,
  createStackScript,
  getStackScripts,
} from "@linode/api-v4"
import type { Linode, CreateLinodeRequest } from "@linode/api-v4/lib/linodes"
import { OPENCLAW_VERSION } from "@/lib/openclaw"

let tokenInitialized = false
function ensureToken() {
  if (tokenInitialized) return
  const token = process.env.LINODE_API_TOKEN
  if (!token) {
    throw new Error("LINODE_API_TOKEN is not set")
  }
  setToken(token)
  tokenInitialized = true
}

/**
 * StackScript run on first boot. Installs Node 20 LTS, OpenClaw (pinned npm),
 * and Caddy. No Docker anywhere. Every phase validated before continuing.
 */
export function buildStackScript(): string {
  const ver = OPENCLAW_VERSION()
  return `#!/bin/bash
# <UDF name="ssh_public_key" label="SSH public key to authorize for root" />
set -euxo pipefail

export DEBIAN_FRONTEND=noninteractive

# --- Phase 1: System bootstrap ---
apt-get update -y && apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg ufw git build-essential

# --- SSH key ---
mkdir -p /root/.ssh
chmod 700 /root/.ssh
echo "$SSH_PUBLIC_KEY" >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

# --- Phase 2: Node 20 LTS via NodeSource ---
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v && npm -v

# --- Phase 3: Dedicated service user + working directory ---
useradd --system --home-dir /opt/openclaw --shell /usr/sbin/nologin openclaw || true
mkdir -p /opt/openclaw
chown -R openclaw:openclaw /opt/openclaw
mkdir -p /var/tmp/openclaw-compile-cache
chown openclaw:openclaw /var/tmp/openclaw-compile-cache

# --- Phase 4: Install OpenClaw (pinned) ---
SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install -g openclaw@${ver}
openclaw --version

# --- Phase 8: Install Caddy ---
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y
apt-get install -y caddy

# --- Firewall ---
ufw allow 22/tcp || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
yes | ufw enable || true
`
}

export const SHARED_HOST_STACKSCRIPT_LABEL = "sovereignml-native-v1"

/**
 * Turn a Linode/axios error into a single readable line. Crucial for logs:
 * the raw AxiosError includes `config.headers.Authorization` (our bearer
 * token), which must never land in pm2 log files. Callers should use this
 * in place of `err.message` or the default console.error(err) dump.
 */
export function describeLinodeError(err: unknown): string {
  const e = err as {
    response?: { status?: number; data?: { errors?: Array<{ field?: string; reason?: string }> } }
    message?: string
  }
  const status = e?.response?.status
  const errors = e?.response?.data?.errors
  if (Array.isArray(errors) && errors.length > 0) {
    const parts = errors.map((x) => (x.field ? `${x.field}: ${x.reason ?? ""}` : x.reason ?? ""))
    return status ? `Linode ${status}: ${parts.join("; ")}` : parts.join("; ")
  }
  if (status) return `Linode ${status}: ${e.message ?? "unknown"}`
  return e?.message ?? String(err)
}

export async function linodeCreateVM(
  payload: Pick<CreateLinodeRequest, "label" | "type" | "region" | "root_pass"> & {
    stackscript_id?: number
    stackscript_data?: Record<string, string>
    image?: string
    authorized_keys?: string[]
    tags?: string[]
  }
): Promise<Linode> {
  ensureToken()
  return createLinode({
    ...payload,
    image: payload.image ?? "linode/ubuntu24.04",
  } as CreateLinodeRequest)
}

/** Returns true if the VM was deleted, false if it did not exist (404). */
export async function linodeDeleteVM(linodeId: number): Promise<boolean> {
  ensureToken()
  try {
    await deleteLinode(linodeId)
    return true
  } catch (err) {
    if (isLinodeNotFound(err)) return false
    throw err
  }
}

export async function linodeGetVM(linodeId: number): Promise<Linode> {
  ensureToken()
  return getLinode(linodeId)
}

/** Returns null if the VM does not exist. */
export async function linodeGetVMOrNull(linodeId: number): Promise<Linode | null> {
  ensureToken()
  try {
    return await getLinode(linodeId)
  } catch (err) {
    if (isLinodeNotFound(err)) return null
    throw err
  }
}

export function isLinodeNotFound(err: unknown): boolean {
  const e = err as { response?: { status?: number } }
  return e?.response?.status === 404
}

/**
 * List every VM in the account, optionally filtered by tag. Paginated —
 * walks until `page * page_size >= results`.
 *
 * Used by the reconciler to detect orphans: VMs that exist in Linode but
 * have no matching DB row.
 */
export async function linodeListAllVMs(
  opts: { tag?: string } = {},
): Promise<Linode[]> {
  ensureToken()
  const out: Linode[] = []
  const pageSize = 100
  let page = 1
  // The Linode SDK accepts a filter param; +order/+order_by are also valid.
  // We tag every VM we create with "sovereignml"; filter by it.
  const filter: Record<string, unknown> = {}
  if (opts.tag) filter["+order"] = "asc"
  while (true) {
    const resp = await getLinodes({ page, page_size: pageSize }, filter)
    const data = resp.data ?? []
    for (const vm of data) {
      if (!opts.tag || (vm.tags ?? []).includes(opts.tag)) {
        out.push(vm)
      }
    }
    if (page * pageSize >= (resp.results ?? 0)) break
    page++
    if (page > 50) break // safety: 5000 VMs is already absurd
  }
  return out
}

/**
 * Find-or-create the shared host StackScript in the user's Linode account.
 * Re-uses existing one by label so repeated bootstrap runs don't duplicate.
 */
export async function ensureSharedHostStackScript(): Promise<number> {
  ensureToken()
  const existing = await getStackScripts(
    { page_size: 100 },
    { label: SHARED_HOST_STACKSCRIPT_LABEL, mine: true }
  )
  const match = existing.data.find((s) => s.label === SHARED_HOST_STACKSCRIPT_LABEL)
  if (match) return match.id

  const created = await createStackScript({
    label: SHARED_HOST_STACKSCRIPT_LABEL,
    description: "SovereignML VPS bootstrap — installs Node 20 LTS, OpenClaw (pinned), Caddy, and authorizes fleet SSH key.",
    images: ["linode/ubuntu24.04"],
    script: buildStackScript(),
    is_public: false,
    rev_note: "initial",
  })
  return created.id
}
