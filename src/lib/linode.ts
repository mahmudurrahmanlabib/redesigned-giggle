import {
  createLinode,
  deleteLinode,
  getLinode,
  setToken,
  createStackScript,
  getStackScripts,
} from "@linode/api-v4"
import type { Linode, CreateLinodeRequest } from "@linode/api-v4/lib/linodes"

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
 * StackScript body run on first boot of a shared Linode host. Installs Docker
 * and appends our SSH public key to root's authorized_keys so the web app
 * can orchestrate containers over SSH.
 */
export const SHARED_HOST_STACKSCRIPT = `#!/bin/bash
# <UDF name="ssh_public_key" label="SSH public key to authorize for root" />
set -eux
apt-get update -y
apt-get install -y docker.io ca-certificates curl
systemctl enable --now docker

mkdir -p /root/.ssh
chmod 700 /root/.ssh
echo "$SSH_PUBLIC_KEY" >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

# Pre-pull the bot runtime image to cut cold-start on first deploy.
if [ -n "$BOT_RUNTIME_IMAGE" ]; then
  docker pull "$BOT_RUNTIME_IMAGE" || true
fi
`

export const SHARED_HOST_STACKSCRIPT_LABEL = "sovereignml-shared-host-v1"

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

export async function linodeDeleteVM(linodeId: number): Promise<void> {
  ensureToken()
  await deleteLinode(linodeId)
}

export async function linodeGetVM(linodeId: number): Promise<Linode> {
  ensureToken()
  return getLinode(linodeId)
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
    description: "SovereignML shared host bootstrap — installs Docker, authorizes fleet SSH key.",
    images: ["linode/ubuntu24.04"],
    script: SHARED_HOST_STACKSCRIPT,
    is_public: false,
    rev_note: "initial",
  })
  return created.id
}
