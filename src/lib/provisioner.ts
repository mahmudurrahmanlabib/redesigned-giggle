import type { InferSelectModel } from "drizzle-orm"
import { db, instances, instanceLogs, eq } from "@/db"
import { allocatePort, FleetEmptyError, FleetFullError, pickHost } from "@/lib/host-scheduler"
import {
  sshComposeUp,
  sshConfigureUfw,
  sshDockerRestart,
  sshDockerRm,
  sshDockerRun,
  sshDockerStart,
  sshDockerStop,
  sshWriteFile,
} from "@/lib/ssh"
import { decryptSecret, encryptSecret } from "@/lib/crypto-secret"
import {
  buildOpenclawEnv,
  generateAdminPassword,
  OPENCLAW_IMAGE,
  renderCaddyfile,
  renderComposeFile,
  renderDotenv,
} from "@/lib/openclaw"
import {
  ensureSharedHostStackScript,
  linodeCreateVM,
  linodeDeleteVM,
  linodeGetVM,
} from "@/lib/linode"
import { generateMockIp } from "@/lib/instance"
import { routeModel } from "@/lib/model-router"
import type { BudgetTier } from "@/lib/agent-config"

type Instance = InferSelectModel<typeof instances>

const BOT_RUNTIME_IMAGE = () =>
  process.env.BOT_RUNTIME_IMAGE || "ghcr.io/sovereignml/sovereign-bot-runtime:latest"

const NEXT_PUBLIC_GATEWAY_BASE_URL = () =>
  process.env.NEXT_PUBLIC_GATEWAY_BASE_URL || "http://localhost:3000"

const OPENROUTER_API_KEY = () => process.env.OPENROUTER_API_KEY || ""

const LINODE_DEFAULT_REGION = "us-east" // Newark
const LINODE_SHARED_PLAN = "g6-standard-2"
const LINODE_VPS_DEFAULT_PLAN = "g6-standard-1"

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function isLiveMode(): boolean {
  return Boolean(process.env.LINODE_API_TOKEN && process.env.SSH_FLEET_PRIVATE_KEY)
}

function buildContainerName(instanceId: string): string {
  return `bot_${instanceId.slice(0, 12)}`
}

type BotEnv = Record<string, string>
function buildBotEnv(instance: Instance, extras: BotEnv = {}): BotEnv {
  const tier = (instance.modelTier ?? "mid") as BudgetTier
  const route = routeModel(tier)

  const env: BotEnv = {
    BOT_TOKEN: instance.botToken ?? "",
    SOUL_MD: instance.soulMd ?? "You are a helpful assistant.",
    MODEL: route.model,
    FALLBACK_MODEL: route.fallback,
    OPENROUTER_API_KEY: OPENROUTER_API_KEY(),
    USAGE_INGEST_URL: `${NEXT_PUBLIC_GATEWAY_BASE_URL()}/api/usage/ingest`,
    INSTANCE_ID: instance.id,
    PORT: "3000",
  }

  if (instance.telegramBotTokenEnc) {
    try {
      env.TELEGRAM_BOT_TOKEN = decryptSecret(instance.telegramBotTokenEnc)
    } catch (err) {
      console.warn(`[provisioner] failed to decrypt Telegram token for ${instance.id}:`, err)
    }
  }

  return { ...env, ...extras }
}

async function waitForLinodeRunning(linodeId: number, timeoutMs = 180_000): Promise<string> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const vm = await linodeGetVM(linodeId)
    if (vm.status === "running" && vm.ipv4?.[0]) {
      return vm.ipv4[0]
    }
    await new Promise((r) => setTimeout(r, 5_000))
  }
  throw new Error(`Linode ${linodeId} did not reach "running" within ${timeoutMs}ms`)
}

function generateRootPassword(): string {
  // 24-char alphanumeric — only used to satisfy Linode's create API; we rely
  // on key-based SSH, not password auth.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
  let out = ""
  for (let i = 0; i < 24; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

/* ------------------------------------------------------------------ */
/* provision                                                           */
/* ------------------------------------------------------------------ */

export type ProvisionResult = {
  ipAddress: string
  containerName?: string
  containerPort?: number
  botHostId?: string
  linodeId?: number
  mocked: boolean
}

export async function provisionBot(instance: Instance): Promise<ProvisionResult> {
  const target = instance.deploymentTarget ?? "shared"

  if (!isLiveMode()) {
    // Dev fallback — no Linode / SSH credentials. Preserve existing mock flow.
    const ipAddress = instance.ipAddress ?? generateMockIp()
    await db
      .update(instances)
      .set({ ipAddress, status: "running", lastActiveAt: new Date() })
      .where(eq(instances.id, instance.id))
    await db.insert(instanceLogs).values({
      instanceId: instance.id,
      level: "info",
      message: `[dev] Mock-provisioned (${target}). Set LINODE_API_TOKEN + SSH_FLEET_PRIVATE_KEY to provision for real.`,
    })
    return { ipAddress, mocked: true }
  }

  if (target === "vps") {
    return provisionVpsBot(instance)
  }
  return provisionSharedBot(instance)
}

async function provisionSharedBot(instance: Instance): Promise<ProvisionResult> {
  let host
  try {
    host = await pickHost()
  } catch (err) {
    if (err instanceof FleetEmptyError || err instanceof FleetFullError) {
      await db.insert(instanceLogs).values({
        instanceId: instance.id,
        level: "error",
        message: `Provisioning failed: ${err.message}`,
      })
      await db
        .update(instances)
        .set({ status: "failed" })
        .where(eq(instances.id, instance.id))
    }
    throw err
  }

  const port = await allocatePort(host.id)
  const containerName = buildContainerName(instance.id)

  await sshDockerRun(
    { host: host.ipAddress },
    {
      image: BOT_RUNTIME_IMAGE(),
      containerName,
      hostPort: port,
      env: buildBotEnv(instance),
    }
  )

  await db
    .update(instances)
    .set({
      status: "running",
      ipAddress: host.ipAddress,
      botHostId: host.id,
      containerName,
      containerPort: port,
      lastActiveAt: new Date(),
    })
    .where(eq(instances.id, instance.id))
  await db.insert(instanceLogs).values({
    instanceId: instance.id,
    level: "info",
    message: `Provisioned on shared host ${host.id} (${host.ipAddress}:${port}).`,
  })

  return {
    ipAddress: host.ipAddress,
    containerName,
    containerPort: port,
    botHostId: host.id,
    mocked: false,
  }
}

const OPENCLAW_DIR = "/opt/openclaw"

async function provisionVpsBot(instance: Instance): Promise<ProvisionResult> {
  // Idempotency: if this instance already has a linode and it's running, reuse it.
  let linodeId = instance.linodeId ?? undefined
  let ipAddress = instance.ipAddress ?? undefined

  if (!linodeId) {
    const stackScriptId = await ensureSharedHostStackScript()
    const publicKey = process.env.SSH_FLEET_PUBLIC_KEY

    const vm = await linodeCreateVM({
      label: `sovereign-vps-${instance.id.slice(0, 8)}`,
      type: LINODE_VPS_DEFAULT_PLAN,
      region: LINODE_DEFAULT_REGION,
      root_pass: generateRootPassword(),
      stackscript_id: stackScriptId,
      stackscript_data: {
        SSH_PUBLIC_KEY: publicKey ?? "",
      },
      authorized_keys: publicKey ? [publicKey] : undefined,
      tags: ["sovereignml", "openclaw", "vps"],
    })
    linodeId = vm.id
    ipAddress = await waitForLinodeRunning(vm.id)

    // Give cloud-init time to finish apt install before SSHing.
    await new Promise((r) => setTimeout(r, 10_000))
  } else if (!ipAddress) {
    ipAddress = await waitForLinodeRunning(linodeId)
  }

  if (!ipAddress) {
    throw new Error(`VPS for instance ${instance.id} has no IP address`)
  }

  const target = { host: ipAddress }

  // 1. Minimal hardening — ufw allow 22/80/443.
  await sshConfigureUfw(target)

  // 2. Prepare admin credentials (reuse persisted password if already provisioned).
  const adminEmail =
    instance.openclawAdminEmail ??
    `admin+${instance.id.slice(0, 8)}@openclaw.local`
  let adminPassword: string
  if (instance.openclawAdminPasswordEnc) {
    adminPassword = decryptSecret(instance.openclawAdminPasswordEnc)
  } else {
    adminPassword = generateAdminPassword()
  }

  // 3. Write compose + Caddyfile + .env to /opt/openclaw.
  const env = buildOpenclawEnv({
    instance: { ...instance, openclawAdminEmail: adminEmail },
    adminEmail,
    adminPassword,
    openRouterApiKey: OPENROUTER_API_KEY(),
  })

  await sshWriteFile(
    target,
    `${OPENCLAW_DIR}/docker-compose.yml`,
    renderComposeFile({ image: OPENCLAW_IMAGE() })
  )
  await sshWriteFile(
    target,
    `${OPENCLAW_DIR}/Caddyfile`,
    renderCaddyfile({ domain: instance.domain })
  )
  await sshWriteFile(
    target,
    `${OPENCLAW_DIR}/.env`,
    renderDotenv(env),
    { mode: "600" }
  )

  // 4. Bring up the stack.
  const composeResult = await sshComposeUp(target, OPENCLAW_DIR)
  if (composeResult.code !== 0 && composeResult.code !== null) {
    throw new Error(
      `docker compose up failed (code ${composeResult.code}): ${composeResult.stderr}`
    )
  }

  const containerName = buildContainerName(instance.id)

  await db
    .update(instances)
    .set({
      status: "running",
      ipAddress,
      linodeId,
      containerName,
      containerPort: instance.domain ? 443 : 80,
      openclawAdminEmail: adminEmail,
      openclawAdminPasswordEnc: instance.openclawAdminPasswordEnc ?? encryptSecret(adminPassword),
      dnsStatus: instance.domain ? "pending" : "ready",
      tlsStatus: instance.domain ? "pending" : "issued",
      lastActiveAt: new Date(),
    })
    .where(eq(instances.id, instance.id))
  await db.insert(instanceLogs).values({
    instanceId: instance.id,
    level: "info",
    message: `OpenClaw stack deployed on linode ${linodeId} at ${ipAddress}${
      instance.domain ? ` (domain ${instance.domain})` : ""
    }.`,
  })

  return {
    ipAddress,
    containerName,
    containerPort: instance.domain ? 443 : 80,
    linodeId,
    mocked: false,
  }
}

/* ------------------------------------------------------------------ */
/* lifecycle                                                           */
/* ------------------------------------------------------------------ */

export async function restartBot(instance: Instance): Promise<void> {
  if (!isLiveMode() || !instance.containerName || !instance.ipAddress) {
    await db
      .update(instances)
      .set({ status: "running", lastActiveAt: new Date() })
      .where(eq(instances.id, instance.id))
    await db.insert(instanceLogs).values({
      instanceId: instance.id,
      level: "info",
      message: "Restart signal received (mock).",
    })
    return
  }
  await sshDockerRestart({ host: instance.ipAddress }, instance.containerName)
  await db
    .update(instances)
    .set({ status: "running", lastActiveAt: new Date() })
    .where(eq(instances.id, instance.id))
  await db.insert(instanceLogs).values({
    instanceId: instance.id,
    level: "info",
    message: "Container restarted.",
  })
}

export async function pauseBot(instance: Instance): Promise<void> {
  if (!isLiveMode() || !instance.containerName || !instance.ipAddress) {
    await db
      .update(instances)
      .set({ status: "stopped" })
      .where(eq(instances.id, instance.id))
    return
  }
  await sshDockerStop({ host: instance.ipAddress }, instance.containerName)
  await db
    .update(instances)
    .set({ status: "stopped" })
    .where(eq(instances.id, instance.id))
  await db.insert(instanceLogs).values({
    instanceId: instance.id,
    level: "warn",
    message: "Bot paused.",
  })
}

export async function resumeBot(instance: Instance): Promise<void> {
  if (!isLiveMode() || !instance.containerName || !instance.ipAddress) {
    await db
      .update(instances)
      .set({ status: "running" })
      .where(eq(instances.id, instance.id))
    return
  }
  await sshDockerStart({ host: instance.ipAddress }, instance.containerName)
  await db
    .update(instances)
    .set({ status: "running", lastActiveAt: new Date() })
    .where(eq(instances.id, instance.id))
  await db.insert(instanceLogs).values({
    instanceId: instance.id,
    level: "info",
    message: "Bot resumed.",
  })
}

export async function deleteBot(instance: Instance): Promise<void> {
  try {
    if (isLiveMode() && instance.containerName && instance.ipAddress) {
      await sshDockerRm({ host: instance.ipAddress }, instance.containerName)
    }
    if (isLiveMode() && instance.deploymentTarget === "vps" && instance.linodeId) {
      await linodeDeleteVM(instance.linodeId)
    }
  } catch (err) {
    console.warn(`[provisioner] deleteBot cleanup error for ${instance.id}:`, err)
  }
  await db
    .update(instances)
    .set({ status: "deleted" })
    .where(eq(instances.id, instance.id))
  await db.insert(instanceLogs).values({
    instanceId: instance.id,
    level: "warn",
    message: "Instance deleted.",
  })
}

/**
 * Re-apply the bot's env vars by restarting its container. Used after token
 * rotation, Telegram bind, env edit, etc. Mock-safe.
 */
export async function reprovisionBotEnv(instance: Instance): Promise<void> {
  if (!isLiveMode() || !instance.containerName || !instance.ipAddress || !instance.containerPort) {
    await db.insert(instanceLogs).values({
      instanceId: instance.id,
      level: "info",
      message: "Env update signalled (mock).",
    })
    return
  }
  await sshDockerRun(
    { host: instance.ipAddress },
    {
      image: BOT_RUNTIME_IMAGE(),
      containerName: instance.containerName,
      hostPort: instance.containerPort,
      env: buildBotEnv(instance),
      pullFirst: false,
    }
  )
  await db.insert(instanceLogs).values({
    instanceId: instance.id,
    level: "info",
    message: "Container restarted with new env.",
  })
}
