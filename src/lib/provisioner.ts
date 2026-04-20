import type { InferSelectModel } from "drizzle-orm"
import { db, instances, instanceLogs, regions, serverConfigs, eq } from "@/db"
import {
  logInstanceEvent,
  transitionInstance,
  withInstanceLock,
} from "@/lib/instance-state"
import { allocatePort, FleetEmptyError, FleetFullError, pickHost } from "@/lib/host-scheduler"
import {
  sshConfigureUfw,
  sshDockerRestart,
  sshDockerRm,
  sshDockerRun,
  sshDockerStart,
  sshDockerStop,
  sshInstallCaddyfile,
  sshRun,
  sshSystemctlEnable,
  sshSystemctlRestart,
  sshSystemctlStart,
  sshSystemctlStatus,
  sshSystemctlStop,
  sshValidateOpenclawBinary,
  sshWaitForOpenclaw,
  sshWriteFile,
} from "@/lib/ssh"
import { decryptSecret, encryptSecret } from "@/lib/crypto-secret"
import {
  buildOpenclawEnv,
  generateAdminPassword,
  generateGatewayToken,
  OPENCLAW_GATEWAY_PORT,
  OPENCLAW_SERVICE_NAME,
  renderCaddyfile,
  renderEnvFile,
  renderOpenclawConfig,
  renderSystemdUnit,
} from "@/lib/openclaw"
import {
  describeLinodeError,
  ensureSharedHostStackScript,
  linodeCreateVM,
  linodeDeleteVM,
  linodeGetVM,
  linodeGetVMOrNull,
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

const LINODE_FALLBACK_REGION = "us-east"
const LINODE_FALLBACK_PLAN = "g6-standard-2"

const OPENCLAW_DIR = "/opt/openclaw"

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
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
  let out = ""
  for (let i = 0; i < 24; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

function isVps(instance: Instance): boolean {
  return instance.deploymentTarget === "vps"
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

  // Single-flight: prevent a retried webhook / double-fire from running the
  // provisioning pipeline concurrently (which would create duplicate VMs).
  const lock = await withInstanceLock(instance.id, async () => {
    return provisionBotLocked(instance, target)
  })

  if (!lock.acquired) {
    await logInstanceEvent({
      instanceId: instance.id,
      level: "warn",
      stage: "provision",
      action: "lock_contended",
      result: "error",
      message: "Another worker is already provisioning this instance. Skipping.",
    })
    throw new Error(`provisionBot already running for ${instance.id}`)
  }

  return lock.result
}

async function provisionBotLocked(
  instance: Instance,
  target: string,
): Promise<ProvisionResult> {
  // pending → provisioning. Rejects if already provisioning / running / etc.
  await transitionInstance(instance.id, ["pending"], "provisioning", {
    bumpAttempts: "provision",
  })

  if (!isLiveMode()) {
    await logInstanceEvent({
      instanceId: instance.id,
      stage: "provision",
      action: "mock_start",
      message: "Starting provisioning (dev mode)...",
    })
    const ipAddress = instance.ipAddress ?? generateMockIp()
    await transitionInstance(instance.id, ["provisioning"], "running", {
      set: { ipAddress, lastActiveAt: new Date() },
    })
    await logInstanceEvent({
      instanceId: instance.id,
      stage: "provision",
      action: "mock_complete",
      result: "ok",
      message: `Mock-provisioned (${target}). Set LINODE_API_TOKEN + SSH_FLEET_PRIVATE_KEY for real infra.`,
    })
    return { ipAddress, mocked: true }
  }

  if (target === "vps") {
    return provisionVpsBot(instance)
  }
  return provisionSharedBot(instance)
}

/* ------------------------------------------------------------------ */
/* shared-cluster provisioning (Docker on managed fleet — unchanged)   */
/* ------------------------------------------------------------------ */

async function provisionSharedBot(instance: Instance): Promise<ProvisionResult> {
  try {
    await logInstanceEvent({
      instanceId: instance.id,
      stage: "shared",
      action: "pick_host",
      message: "Selecting shared host...",
    })

    const host = await pickHost()
    const port = await allocatePort(host.id)
    const containerName = buildContainerName(instance.id)

    await logInstanceEvent({
      instanceId: instance.id,
      stage: "shared",
      action: "docker_run",
      message: `Starting bot container on ${host.ipAddress}:${port}...`,
    })

    await sshDockerRun(
      { host: host.ipAddress },
      {
        image: BOT_RUNTIME_IMAGE(),
        containerName,
        hostPort: port,
        env: buildBotEnv(instance),
      },
    )

    await transitionInstance(instance.id, ["provisioning"], "running", {
      set: {
        ipAddress: host.ipAddress,
        botHostId: host.id,
        containerName,
        containerPort: port,
        lastActiveAt: new Date(),
      },
    })
    await logInstanceEvent({
      instanceId: instance.id,
      stage: "shared",
      action: "complete",
      result: "ok",
      message: "Deployment complete. Agent is running.",
    })

    return {
      ipAddress: host.ipAddress,
      containerName,
      containerPort: port,
      botHostId: host.id,
      mocked: false,
    }
  } catch (err) {
    // Shared-cluster path has no VM to delete — just mark failed.
    const reason =
      err instanceof FleetEmptyError || err instanceof FleetFullError
        ? err.message
        : describeLinodeError(err)
    await logInstanceEvent({
      instanceId: instance.id,
      level: "error",
      stage: "shared",
      action: "failed",
      result: "error",
      message: `Provisioning failed: ${reason}`,
    })
    await transitionInstance(instance.id, ["provisioning"], "failed_provisioning", {
      error: reason,
    })
    throw err
  }
}

/* ------------------------------------------------------------------ */
/* VPS provisioning (native OpenClaw + systemd + Caddy)                */
/* ------------------------------------------------------------------ */

async function provisionVpsBot(instance: Instance): Promise<ProvisionResult> {
  const [region, serverConfig] = await Promise.all([
    db.query.regions.findFirst({ where: eq(regions.id, instance.regionId) }),
    db.query.serverConfigs.findFirst({ where: eq(serverConfigs.id, instance.serverConfigId) }),
  ])
  const linodeRegion = region?.linodeRegion ?? LINODE_FALLBACK_REGION
  const linodePlan = serverConfig?.linodePlan ?? LINODE_FALLBACK_PLAN

  let linodeId: number | undefined = instance.linodeId ?? undefined
  let ipAddress: string | undefined = instance.ipAddress ?? undefined
  let currentStage = "init"

  try {
    /* --- 1. Create Linode VM ---------------------------------------- */
    currentStage = "create_vm"
    if (!linodeId) {
      await logInstanceEvent({
        instanceId: instance.id,
        stage: currentStage,
        message: `Creating Linode VM (${linodePlan} in ${linodeRegion})...`,
      })

      const stackScriptId = await ensureSharedHostStackScript()
      const publicKey = process.env.SSH_FLEET_PUBLIC_KEY

      const vm = await linodeCreateVM({
        label: `sovereign-vps-${instance.id.slice(0, 8)}`,
        type: linodePlan,
        region: linodeRegion,
        root_pass: generateRootPassword(),
        stackscript_id: stackScriptId,
        stackscript_data: { ssh_public_key: publicKey ?? "" },
        authorized_keys: publicKey ? [publicKey] : undefined,
        tags: ["sovereignml", "openclaw", "vps"],
      })
      linodeId = vm.id

      // PERSIST IMMEDIATELY — the reconciler needs to see this linodeId even
      // if we crash before the VM boots. This closes the orphan window.
      await db
        .update(instances)
        .set({ linodeId })
        .where(eq(instances.id, instance.id))

      await logInstanceEvent({
        instanceId: instance.id,
        stage: currentStage,
        action: "vm_created",
        result: "ok",
        detail: { linodeId },
        message: `VM ${linodeId} created. Waiting for boot...`,
      })
    }

    currentStage = "wait_boot"
    if (!ipAddress) {
      ipAddress = await waitForLinodeRunning(linodeId!)
      await db
        .update(instances)
        .set({ ipAddress })
        .where(eq(instances.id, instance.id))
    }

    const target = { host: ipAddress }

    /* --- 2. Wait for StackScript / binary ---------------------------- */
    currentStage = "openclaw_binary"
    await logInstanceEvent({
      instanceId: instance.id,
      stage: currentStage,
      message: `Server online at ${ipAddress}. Waiting for OpenClaw...`,
    })
    await sshWaitForOpenclaw(target)
    await sshValidateOpenclawBinary(target, OPENCLAW_GATEWAY_PORT)

    /* --- 3. Firewall ------------------------------------------------- */
    currentStage = "firewall"
    await sshConfigureUfw(target)

    /* --- 4. Credentials ---------------------------------------------- */
    currentStage = "credentials"
    const adminEmail =
      instance.openclawAdminEmail ??
      `admin+${instance.id.slice(0, 8)}@openclaw.local`
    const adminPassword = instance.openclawAdminPasswordEnc
      ? decryptSecret(instance.openclawAdminPasswordEnc)
      : generateAdminPassword()
    const gatewayToken = generateGatewayToken()
    const tier = (instance.modelTier ?? "mid") as BudgetTier
    const route = routeModel(tier)

    /* --- 5. Config + env ---------------------------------------------- */
    currentStage = "write_config"
    await logInstanceEvent({
      instanceId: instance.id,
      stage: currentStage,
      message: "Writing OpenClaw configuration...",
    })
    const env = buildOpenclawEnv({
      instance: { ...instance, openclawAdminEmail: adminEmail },
      adminEmail,
      adminPassword,
      openRouterApiKey: OPENROUTER_API_KEY(),
    })
    await sshWriteFile(
      target,
      `${OPENCLAW_DIR}/config.json5`,
      renderOpenclawConfig({
        gatewayToken,
        openRouterApiKey: OPENROUTER_API_KEY(),
        model: route.model,
        fallbackModel: route.fallback,
        soulMd: instance.soulMd,
      }),
    )
    await sshWriteFile(target, `${OPENCLAW_DIR}/.env`, renderEnvFile(env), { mode: "600" })

    /* --- 6. Caddyfile ------------------------------------------------ */
    currentStage = "caddy"
    await sshInstallCaddyfile(target, renderCaddyfile({ domain: instance.domain }))

    /* --- 7. Systemd + start ------------------------------------------ */
    currentStage = "systemd"
    await sshWriteFile(
      target,
      `/etc/systemd/system/${OPENCLAW_SERVICE_NAME}.service`,
      renderSystemdUnit(),
    )
    await sshRun(target, "systemctl daemon-reload")
    await sshSystemctlEnable(target, OPENCLAW_SERVICE_NAME)
    await sshSystemctlStart(target, OPENCLAW_SERVICE_NAME)

    /* --- 8. Health gate ---------------------------------------------- */
    currentStage = "health_check"
    await new Promise((r) => setTimeout(r, 3_000))
    const statusResult = await sshSystemctlStatus(target, OPENCLAW_SERVICE_NAME)
    if (statusResult.stdout.trim() !== "active") {
      const journal = await sshRun(
        target,
        `journalctl -u ${OPENCLAW_SERVICE_NAME} -n 30 --no-pager`,
      )
      throw new Error(
        `${OPENCLAW_SERVICE_NAME} not active (status: ${statusResult.stdout.trim()}). ` +
          `Journal: ${journal.stdout || journal.stderr}`,
      )
    }
    const healthResult = await sshRun(
      target,
      `curl -sf http://127.0.0.1:${OPENCLAW_GATEWAY_PORT}/health`,
    )
    if (healthResult.code !== 0 && healthResult.code !== null) {
      const journal = await sshRun(
        target,
        `journalctl -u ${OPENCLAW_SERVICE_NAME} -n 30 --no-pager`,
      )
      throw new Error(
        `OpenClaw health check failed (curl exit ${healthResult.code}). ` +
          `Journal: ${journal.stdout || journal.stderr}`,
      )
    }

    /* --- 9. Commit state --------------------------------------------- */
    currentStage = "commit"
    await transitionInstance(instance.id, ["provisioning"], "running", {
      set: {
        ipAddress,
        linodeId,
        containerName: OPENCLAW_SERVICE_NAME,
        containerPort: OPENCLAW_GATEWAY_PORT,
        openclawAdminEmail: adminEmail,
        openclawAdminPasswordEnc:
          instance.openclawAdminPasswordEnc ?? encryptSecret(adminPassword),
        // dns/tls remain NULL unless a domain is configured.
        dnsStatus: instance.domain ? "pending" : null,
        tlsStatus: instance.domain ? "pending" : null,
        lastActiveAt: new Date(),
      },
    })
    await logInstanceEvent({
      instanceId: instance.id,
      stage: "complete",
      result: "ok",
      message: `Deployment complete. Gateway at ${ipAddress}:${OPENCLAW_GATEWAY_PORT}${
        instance.domain ? ` (domain ${instance.domain})` : ""
      }.`,
    })

    return {
      ipAddress,
      containerName: OPENCLAW_SERVICE_NAME,
      containerPort: OPENCLAW_GATEWAY_PORT,
      linodeId,
      mocked: false,
    }
  } catch (err) {
    await rollbackProvisioning(instance.id, linodeId, currentStage, err)
    throw err
  }
}

/**
 * Roll back a failed provisioning attempt.
 *
 * 1. Log the failing stage with a structured `rollback` event.
 * 2. If a Linode VM was created, retry `linodeDeleteVM` with backoff.
 * 3. Transition to `failed_provisioning`. On delete success clear linodeId/ip
 *    so the row is clean. On delete failure keep the id so the reconciler
 *    picks it up on the next pass.
 */
async function rollbackProvisioning(
  instanceId: string,
  linodeId: number | undefined,
  stage: string,
  err: unknown,
): Promise<void> {
  const reason = describeLinodeError(err)
  await logInstanceEvent({
    instanceId,
    level: "error",
    stage,
    action: "failed",
    result: "error",
    detail: { linodeId },
    message: `Provisioning failed at ${stage}: ${reason}`,
  })

  let vmDeleted = false
  if (linodeId) {
    const backoffMs = [1_000, 4_000, 16_000]
    for (let i = 0; i < backoffMs.length; i++) {
      try {
        await linodeDeleteVM(linodeId)
        vmDeleted = true
        break
      } catch (delErr) {
        await logInstanceEvent({
          instanceId,
          level: "warn",
          stage: "rollback",
          action: "delete_vm_retry",
          result: "error",
          detail: { linodeId, attempt: i + 1 },
          message: `linodeDeleteVM retry ${i + 1} failed: ${describeLinodeError(delErr)}`,
        })
        if (i < backoffMs.length - 1) {
          await new Promise((r) => setTimeout(r, backoffMs[i]))
        }
      }
    }
  }

  await transitionInstance(instanceId, ["provisioning"], "failed_provisioning", {
    error: reason,
    set: vmDeleted
      ? { linodeId: null, ipAddress: null }
      : // keep linodeId for reconciler to sweep
        {},
  })

  await logInstanceEvent({
    instanceId,
    level: vmDeleted ? "warn" : "error",
    stage: "rollback",
    action: vmDeleted ? "vm_deleted" : "orphan_pending",
    result: vmDeleted ? "ok" : "error",
    detail: { linodeId },
    message: vmDeleted
      ? `Rollback complete. Linode VM ${linodeId} deleted.`
      : `Rollback incomplete. Linode VM ${linodeId} still exists — awaiting reconciler.`,
  })
}

/* ------------------------------------------------------------------ */
/* lifecycle                                                           */
/* ------------------------------------------------------------------ */

export async function restartBot(instance: Instance): Promise<void> {
  // Restart doesn't change status — it only bumps lastActiveAt.
  if (isLiveMode() && instance.ipAddress) {
    if (isVps(instance)) {
      await sshSystemctlRestart({ host: instance.ipAddress }, OPENCLAW_SERVICE_NAME)
    } else if (instance.containerName) {
      await sshDockerRestart({ host: instance.ipAddress }, instance.containerName)
    }
  }
  await db
    .update(instances)
    .set({ lastActiveAt: new Date() })
    .where(eq(instances.id, instance.id))
  await logInstanceEvent({
    instanceId: instance.id,
    stage: "restart",
    result: "ok",
    message: isLiveMode() ? "Service restarted." : "Restart signal received (mock).",
  })
}

export async function pauseBot(instance: Instance): Promise<void> {
  if (isLiveMode() && instance.ipAddress) {
    if (isVps(instance)) {
      await sshSystemctlStop({ host: instance.ipAddress }, OPENCLAW_SERVICE_NAME)
    } else if (instance.containerName) {
      await sshDockerStop({ host: instance.ipAddress }, instance.containerName)
    }
  }
  await transitionInstance(instance.id, ["running"], "stopped")
  await logInstanceEvent({
    instanceId: instance.id,
    level: "warn",
    stage: "pause",
    result: "ok",
    message: "Bot paused.",
  })
}

export async function resumeBot(instance: Instance): Promise<void> {
  if (isLiveMode() && instance.ipAddress) {
    if (isVps(instance)) {
      await sshSystemctlStart({ host: instance.ipAddress }, OPENCLAW_SERVICE_NAME)
    } else if (instance.containerName) {
      await sshDockerStart({ host: instance.ipAddress }, instance.containerName)
    }
  }
  await transitionInstance(instance.id, ["stopped"], "running", {
    set: { lastActiveAt: new Date() },
  })
  await logInstanceEvent({
    instanceId: instance.id,
    stage: "resume",
    result: "ok",
    message: "Bot resumed.",
  })
}

/**
 * Result of a deletion attempt. `deleted` means the row is now in the
 * `deleted` state. `pending` means Linode delete failed and the row is
 * still in `deleting` — the reconciler will sweep it up.
 */
export type DeleteResult = { status: "deleted" | "pending"; linodeId?: number }

/**
 * Delete an instance. Authoritative contract:
 *
 *   - Transitions to `deleting` atomically (rejects if row is already
 *     `deleted` or not in a deletable state).
 *   - For VPS: retries Linode DELETE with exponential backoff. Verifies
 *     the VM is gone via linodeGetVMOrNull(). On success, transitions to
 *     `deleted`. On exhausted retries, leaves the row in `deleting` so
 *     the reconciler picks it up — DOES NOT silently mark deleted.
 *   - For shared-cluster: docker rm, then mark deleted.
 *
 * Callers should surface the `status` field to the client — `pending`
 * should render as "Deletion in progress" and return HTTP 202.
 */
export async function deleteBot(instance: Instance): Promise<DeleteResult> {
  // Transition into `deleting`. Legal predecessors: running | stopped |
  // failed_provisioning | provisioning. If already deleting/deleted, throws.
  await transitionInstance(
    instance.id,
    ["running", "stopped", "failed_provisioning", "provisioning"],
    "deleting",
    { bumpAttempts: "deletion" },
  )
  await logInstanceEvent({
    instanceId: instance.id,
    level: "warn",
    stage: "delete",
    action: "started",
    message: "Deletion started.",
  })

  // Shared-cluster path: docker rm. No VM to delete.
  if (!isVps(instance)) {
    if (isLiveMode() && instance.ipAddress && instance.containerName) {
      try {
        await sshDockerRm({ host: instance.ipAddress }, instance.containerName)
      } catch (err) {
        await logInstanceEvent({
          instanceId: instance.id,
          level: "warn",
          stage: "delete",
          action: "docker_rm",
          result: "error",
          message: `docker rm failed (continuing): ${describeLinodeError(err)}`,
        })
      }
    }
    await transitionInstance(instance.id, ["deleting"], "deleted", {
      set: { ipAddress: null, containerName: null, containerPort: null },
    })
    await logInstanceEvent({
      instanceId: instance.id,
      level: "warn",
      stage: "delete",
      action: "completed",
      result: "ok",
      message: "Shared-cluster instance deleted.",
    })
    return { status: "deleted" }
  }

  // VPS path: delete the whole Linode VM. No need to clean up systemd /
  // /opt/openclaw first — the VM is going away.
  if (!isLiveMode() || !instance.linodeId) {
    // Dev mode or a row that never provisioned a VM: nothing to do in
    // Linode. Just flip to deleted.
    await transitionInstance(instance.id, ["deleting"], "deleted", {
      set: { ipAddress: null, linodeId: null },
    })
    await logInstanceEvent({
      instanceId: instance.id,
      level: "warn",
      stage: "delete",
      action: "completed",
      result: "ok",
      message: "Instance deleted (no Linode VM to clean up).",
    })
    return { status: "deleted" }
  }

  const linodeId = instance.linodeId
  const backoffMs = [1_000, 4_000, 16_000, 60_000, 300_000]
  let lastErr: unknown = null

  for (let i = 0; i < backoffMs.length; i++) {
    try {
      const deleted = await linodeDeleteVM(linodeId)
      // Verify with a follow-up GET. 404 = gone. Anything else = still there.
      const after = await linodeGetVMOrNull(linodeId)
      if (after == null || deleted) {
        await transitionInstance(instance.id, ["deleting"], "deleted", {
          set: { ipAddress: null, linodeId: null },
        })
        await logInstanceEvent({
          instanceId: instance.id,
          level: "warn",
          stage: "delete",
          action: "completed",
          result: "ok",
          detail: { linodeId, attempts: i + 1 },
          message: `Linode VM ${linodeId} deleted and verified gone.`,
        })
        return { status: "deleted", linodeId }
      }
      // VM still exists despite no error — treat as transient.
      lastErr = new Error(`VM ${linodeId} still present after DELETE`)
    } catch (err) {
      lastErr = err
    }
    await logInstanceEvent({
      instanceId: instance.id,
      level: "warn",
      stage: "delete",
      action: "retry",
      result: "error",
      detail: { linodeId, attempt: i + 1 },
      message: `linodeDeleteVM attempt ${i + 1} failed: ${describeLinodeError(lastErr)}`,
    })
    if (i < backoffMs.length - 1) {
      await new Promise((r) => setTimeout(r, backoffMs[i]))
    }
  }

  // Retries exhausted. Leave row in `deleting` for the reconciler. Record
  // the error but do NOT silently mark deleted.
  await db
    .update(instances)
    .set({ lastError: `delete retries exhausted: ${describeLinodeError(lastErr)}` })
    .where(eq(instances.id, instance.id))
  await logInstanceEvent({
    instanceId: instance.id,
    level: "error",
    stage: "delete",
    action: "pending_reconciler",
    result: "error",
    detail: { linodeId },
    message: `Linode delete failed after ${backoffMs.length} retries. Reconciler will sweep.`,
  })
  return { status: "pending", linodeId }
}

/**
 * Re-apply the bot's env/config by rewriting files and restarting.
 * Used after token rotation, Telegram bind, env edit, etc.
 */
export async function reprovisionBotEnv(instance: Instance): Promise<void> {
  if (!isLiveMode() || !instance.ipAddress) {
    await db.insert(instanceLogs).values({
      instanceId: instance.id,
      level: "info",
      message: "Env update signalled (mock).",
    })
    return
  }

  const target = { host: instance.ipAddress }

  if (isVps(instance)) {
    const adminEmail =
      instance.openclawAdminEmail ??
      `admin+${instance.id.slice(0, 8)}@openclaw.local`
    let adminPassword: string
    if (instance.openclawAdminPasswordEnc) {
      adminPassword = decryptSecret(instance.openclawAdminPasswordEnc)
    } else {
      adminPassword = generateAdminPassword()
    }

    const tier = (instance.modelTier ?? "mid") as BudgetTier
    const route = routeModel(tier)

    const env = buildOpenclawEnv({
      instance: { ...instance, openclawAdminEmail: adminEmail },
      adminEmail,
      adminPassword,
      openRouterApiKey: OPENROUTER_API_KEY(),
    })

    await sshWriteFile(
      target,
      `${OPENCLAW_DIR}/config.json5`,
      renderOpenclawConfig({
        gatewayToken: generateGatewayToken(),
        openRouterApiKey: OPENROUTER_API_KEY(),
        model: route.model,
        fallbackModel: route.fallback,
        soulMd: instance.soulMd,
      }),
    )
    await sshWriteFile(
      target,
      `${OPENCLAW_DIR}/.env`,
      renderEnvFile(env),
      { mode: "600" },
    )
    await sshSystemctlRestart(target, OPENCLAW_SERVICE_NAME)

    await db.insert(instanceLogs).values({
      instanceId: instance.id,
      level: "info",
      message: "OpenClaw service restarted with new config.",
    })
  } else if (instance.containerName && instance.containerPort) {
    await sshDockerRun(
      target,
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
}
