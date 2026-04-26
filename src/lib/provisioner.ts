import type { InferSelectModel } from "drizzle-orm"
import { db, instances, instanceLogs, regions, serverConfigs, eq } from "@/db"
import {
  logInstanceEvent,
  transitionInstance,
  withInstanceLock,
} from "@/lib/instance-state"
import { allocatePort, FleetEmptyError, FleetFullError, pickHost } from "@/lib/host-scheduler"
import {
  sshDockerRestart,
  sshDockerRm,
  sshDockerRun,
  sshDockerStart,
  sshDockerStop,
  sshInstallCaddyfile,
  sshRun,
  sshRunLogged,
  sshSystemctlEnable,
  sshSystemctlRestart,
  sshSystemctlStart,
  sshSystemctlStatus,
  sshSystemctlStop,
  sshWaitForOpenclaw,
  sshWaitReady,
  sshWriteFile,
  type SshTarget,
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
import { createAgentSubdomain, deleteAgentSubdomain } from "@/lib/agent-dns"
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

const VPS_STAGES = [
  "create_vm",
  "wait_boot",
  "waiting_ssh",
  "validating_binary",
  "writing_config",
  "installing_service",
  "starting_service",
  "health_check",
  "commit",
] as const
type VpsStage = (typeof VPS_STAGES)[number]

async function setProvisionStage(instanceId: string, stage: VpsStage): Promise<void> {
  await db
    .update(instances)
    .set({ provisionStage: stage })
    .where(eq(instances.id, instanceId))
  await logInstanceEvent({
    instanceId,
    stage,
    action: "stage_enter",
    message: `Entering stage: ${stage}`,
  })
}

/**
 * Log every SSH step result to the instance log for full observability.
 */
async function logSshStep(
  instanceId: string,
  step: Awaited<ReturnType<typeof sshRunLogged>>,
): Promise<void> {
  const ok = step.exitCode === 0 || step.exitCode === null
  await logInstanceEvent({
    instanceId,
    level: ok ? "info" : "warn",
    stage: step.stage,
    action: "ssh_exec",
    result: ok ? "ok" : "error",
    durationMs: step.durationMs,
    detail: {
      command: step.command,
      exitCode: step.exitCode,
      stdout: step.stdout.slice(0, 4000),
      stderr: step.stderr.slice(0, 4000),
    },
    message: ok
      ? `SSH OK (${step.durationMs}ms): ${step.command.slice(0, 120)}`
      : `SSH FAIL exit=${step.exitCode} (${step.durationMs}ms): ${step.command.slice(0, 120)}`,
  })
}

/**
 * Collect diagnostic logs from the VM for failure analysis.
 * Best-effort — individual commands may fail if SSH is unreachable.
 */
async function collectDiagnostics(
  target: SshTarget,
  instanceId: string,
): Promise<void> {
  const commands: [string, string][] = [
    [`journalctl -u ${OPENCLAW_SERVICE_NAME} --no-pager -n 200`, "journal"],
    [`systemctl status ${OPENCLAW_SERVICE_NAME} --no-pager`, "service_status"],
    ["cat /opt/openclaw/.env 2>/dev/null | grep -v API_KEY | grep -v PASSWORD", "env_sanitized"],
    ["ls -la /opt/openclaw/", "workdir_listing"],
    ["which openclaw 2>/dev/null || echo 'not found'", "binary_path"],
    ["node -v 2>/dev/null || echo 'node not found'", "node_version"],
  ]
  for (const [cmd, label] of commands) {
    try {
      const result = await sshRun(target, cmd)
      await logInstanceEvent({
        instanceId,
        level: "error",
        stage: "diagnostics",
        action: label,
        detail: {
          stdout: result.stdout.slice(0, 8000),
          stderr: result.stderr.slice(0, 4000),
          code: result.code,
        },
        message: `Diagnostic [${label}]`,
      })
    } catch {
      await logInstanceEvent({
        instanceId,
        level: "error",
        stage: "diagnostics",
        action: label,
        result: "error",
        message: `Diagnostic [${label}]: SSH unreachable`,
      })
    }
  }
}

async function provisionVpsBot(instance: Instance): Promise<ProvisionResult> {
  const [region, serverConfig] = await Promise.all([
    db.query.regions.findFirst({ where: eq(regions.id, instance.regionId) }),
    db.query.serverConfigs.findFirst({ where: eq(serverConfigs.id, instance.serverConfigId) }),
  ])
  const linodeRegion = region?.linodeRegion ?? LINODE_FALLBACK_REGION
  const linodePlan = serverConfig?.linodePlan ?? LINODE_FALLBACK_PLAN

  let linodeId: number | undefined = instance.linodeId ?? undefined
  let ipAddress: string | undefined = instance.ipAddress ?? undefined
  let currentStage: VpsStage = "create_vm"

  try {
    /* --- 1. Create Linode VM ---------------------------------------- */
    currentStage = "create_vm"
    await setProvisionStage(instance.id, currentStage)
    if (!linodeId) {
      await logInstanceEvent({
        instanceId: instance.id,
        stage: currentStage,
        message: `Creating Linode VM (${linodePlan} in ${linodeRegion})...`,
      })

      const stackScriptId = await ensureSharedHostStackScript()
      const publicKey = process.env.SSH_FLEET_PUBLIC_KEY

      const rootPassword = generateRootPassword()
      const vm = await linodeCreateVM({
        label: `sovereign-vps-${instance.id.slice(0, 8)}`,
        type: linodePlan,
        region: linodeRegion,
        root_pass: rootPassword,
        stackscript_id: stackScriptId,
        stackscript_data: {
          ssh_public_key: publicKey ?? "",
          cf_origin_cert_b64: process.env.CLOUDFLARE_ORIGIN_CERT_PEM ?? "",
          cf_origin_key_b64: process.env.CLOUDFLARE_ORIGIN_CERT_KEY ?? "",
        },
        authorized_keys: publicKey ? [publicKey] : undefined,
        tags: ["sovereignml", "openclaw", "vps"],
      })
      linodeId = vm.id

      await db
        .update(instances)
        .set({ linodeId, rootPasswordEnc: encryptSecret(rootPassword) })
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

    /* --- 2. Wait for boot ------------------------------------------- */
    currentStage = "wait_boot"
    await setProvisionStage(instance.id, currentStage)
    if (!ipAddress) {
      ipAddress = await waitForLinodeRunning(linodeId!)
      await db
        .update(instances)
        .set({ ipAddress })
        .where(eq(instances.id, instance.id))
    }

    /* --- 2b. Cloudflare managed subdomain --------------------------- */
    if (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ZONE_ID) {
      try {
        const { name, recordId } = await createAgentSubdomain(
          instance.id,
          ipAddress,
        )
        await db
          .update(instances)
          .set({
            managedSubdomain: name,
            cfRecordId: recordId,
            dnsStatus: "propagating",
          })
          .where(eq(instances.id, instance.id))
        await logInstanceEvent({
          instanceId: instance.id,
          stage: currentStage,
          message: `Cloudflare DNS upserted: ${name} → ${ipAddress} (proxied)`,
        })
      } catch (cfErr) {
        await logInstanceEvent({
          instanceId: instance.id,
          stage: currentStage,
          message: `Cloudflare DNS upsert failed (continuing without managed subdomain): ${
            cfErr instanceof Error ? cfErr.message : String(cfErr)
          }`,
          level: "warn",
        })
      }
    }

    const target: SshTarget = { host: ipAddress }

    /* --- 3. Wait for SSH readiness ---------------------------------- */
    currentStage = "waiting_ssh"
    await setProvisionStage(instance.id, currentStage)
    await logInstanceEvent({
      instanceId: instance.id,
      stage: currentStage,
      message: `Server online at ${ipAddress}. Waiting for SSH...`,
    })
    await sshWaitReady(target)

    /* --- 4. Validate OpenClaw binary -------------------------------- */
    currentStage = "validating_binary"
    await setProvisionStage(instance.id, currentStage)
    await logInstanceEvent({
      instanceId: instance.id,
      stage: currentStage,
      message: "Waiting for OpenClaw binary (StackScript install or SSH fallback)...",
    })
    await sshWaitForOpenclaw(target)

    // Ensure the openclaw user/dirs exist — StackScript may have aborted before Phase 3
    const userStep = await sshRunLogged(
      target,
      "id openclaw >/dev/null 2>&1 || useradd --system --home-dir /opt/openclaw --shell /usr/sbin/nologin openclaw && mkdir -p /opt/openclaw && chown -R openclaw:openclaw /opt/openclaw && mkdir -p /var/tmp/openclaw-compile-cache && chown openclaw:openclaw /var/tmp/openclaw-compile-cache",
      currentStage,
    )
    await logSshStep(instance.id, userStep)
    if (userStep.exitCode !== 0 && userStep.exitCode !== null) {
      throw new Error(`Failed to ensure openclaw user: ${userStep.stderr}`)
    }

    const versionStep = await sshRunLogged(target, "openclaw --version", currentStage)
    await logSshStep(instance.id, versionStep)
    if (versionStep.exitCode !== 0 && versionStep.exitCode !== null) {
      throw new Error(
        `openclaw --version failed (exit ${versionStep.exitCode}): ${versionStep.stderr || versionStep.stdout}`,
      )
    }

    const whichStep = await sshRunLogged(target, "which openclaw", currentStage)
    await logSshStep(instance.id, whichStep)

    await logInstanceEvent({
      instanceId: instance.id,
      stage: currentStage,
      action: "binary_validated",
      result: "ok",
      message: `OpenClaw binary validated: ${versionStep.stdout.trim()}`,
    })

    /* --- 5. Credentials --------------------------------------------- */
    const adminEmail =
      instance.openclawAdminEmail ??
      `admin+${instance.id.slice(0, 8)}@openclaw.local`
    const adminPassword = instance.openclawAdminPasswordEnc
      ? decryptSecret(instance.openclawAdminPasswordEnc)
      : generateAdminPassword()
    const gatewayToken = generateGatewayToken()
    const tier = (instance.modelTier ?? "mid") as BudgetTier
    const route = routeModel(tier)

    /* --- 6. Write .env ---------------------------------------------- */
    currentStage = "writing_config"
    await setProvisionStage(instance.id, currentStage)
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

    const envContent = renderEnvFile(env)
    const envB64 = Buffer.from(envContent, "utf8").toString("base64")
    const envStep = await sshRunLogged(
      target,
      `echo '${envB64}' | base64 -d > '${OPENCLAW_DIR}/.env' && chmod 600 '${OPENCLAW_DIR}/.env' && chown openclaw:openclaw '${OPENCLAW_DIR}/.env'`,
      currentStage,
    )
    await logSshStep(instance.id, envStep)
    if (envStep.exitCode !== 0 && envStep.exitCode !== null) {
      throw new Error(`Failed to write .env: ${envStep.stderr}`)
    }

    /* --- 7. OpenClaw onboard (let it initialize its own config) ----- */
    const onboardStep = await sshRunLogged(
      target,
      `sudo -u openclaw HOME=${OPENCLAW_DIR} /usr/bin/openclaw onboard --mode local --yes 2>&1`,
      currentStage,
    )
    await logSshStep(instance.id, onboardStep)
    if (onboardStep.exitCode !== 0 && onboardStep.exitCode !== null) {
      await logInstanceEvent({
        instanceId: instance.id,
        level: "warn",
        stage: currentStage,
        action: "onboard_failed",
        message: `openclaw onboard failed (exit ${onboardStep.exitCode}), continuing with config set...`,
      })
    }

    /* --- 8. Overlay our settings via openclaw config set ------------ */
    const allowedOrigin = instance.domain
      ? `https://${instance.domain}`
      : `http://${ipAddress}`

    const configCmds = [
      `openclaw config set gateway.port ${OPENCLAW_GATEWAY_PORT}`,
      `openclaw config set gateway.bind localhost`,
      `openclaw config set gateway.auth.token ${JSON.stringify(gatewayToken)}`,
      `openclaw config set gateway.remote.token ${JSON.stringify(gatewayToken)}`,
      `openclaw config set gateway.trustedProxies '["127.0.0.1"]'`,
      `openclaw config set gateway.controlUi.allowedOrigins '${JSON.stringify([allowedOrigin])}'`,
      `openclaw config set gateway.controlUi.allowInsecureAuth true`,
      `openclaw config set gateway.controlUi.dangerouslyDisableDeviceAuth true`,
      `openclaw config set agents.defaults.model.primary ${JSON.stringify(route.model)}`,
      `openclaw config set agents.defaults.model.fallbacks '${JSON.stringify([route.fallback])}'`,
    ]
    for (const cmd of configCmds) {
      const step = await sshRunLogged(
        target,
        `sudo -u openclaw HOME=${OPENCLAW_DIR} /usr/bin/${cmd} 2>&1`,
        currentStage,
      )
      await logSshStep(instance.id, step)
    }

    // Doctor to validate final config (log only, don't fail)
    const doctorStep = await sshRunLogged(
      target,
      `sudo -u openclaw HOME=${OPENCLAW_DIR} /usr/bin/openclaw doctor 2>&1 || true`,
      currentStage,
    )
    await logSshStep(instance.id, doctorStep)

    // Log the final config for debugging
    const configDump = await sshRunLogged(
      target,
      `cat ${OPENCLAW_DIR}/.openclaw/openclaw.json 2>/dev/null || echo 'no config file'`,
      currentStage,
    )
    await logSshStep(instance.id, configDump)

    // Caddyfile
    const caddyContent = renderCaddyfile({ domain: instance.domain })
    const caddyB64 = Buffer.from(caddyContent, "utf8").toString("base64")
    const caddyStep = await sshRunLogged(
      target,
      `echo '${caddyB64}' | base64 -d > /etc/caddy/Caddyfile && systemctl reload caddy 2>&1 || true`,
      currentStage,
    )
    await logSshStep(instance.id, caddyStep)

    /* --- 9. Systemd install ----------------------------------------- */
    currentStage = "installing_service"
    await setProvisionStage(instance.id, currentStage)

    const unitContent = renderSystemdUnit()
    const unitB64 = Buffer.from(unitContent, "utf8").toString("base64")
    const unitStep = await sshRunLogged(
      target,
      `echo '${unitB64}' | base64 -d > '/etc/systemd/system/${OPENCLAW_SERVICE_NAME}.service'`,
      currentStage,
    )
    await logSshStep(instance.id, unitStep)
    if (unitStep.exitCode !== 0 && unitStep.exitCode !== null) {
      throw new Error(`Failed to write systemd unit: ${unitStep.stderr}`)
    }

    const reloadStep = await sshRunLogged(target, "systemctl daemon-reload", currentStage)
    await logSshStep(instance.id, reloadStep)

    const enableStep = await sshRunLogged(
      target,
      `systemctl enable ${OPENCLAW_SERVICE_NAME}`,
      currentStage,
    )
    await logSshStep(instance.id, enableStep)

    /* --- 10. Start service ------------------------------------------ */
    currentStage = "starting_service"
    await setProvisionStage(instance.id, currentStage)

    const startStep = await sshRunLogged(
      target,
      `systemctl start ${OPENCLAW_SERVICE_NAME}`,
      currentStage,
    )
    await logSshStep(instance.id, startStep)

    // Wait for the service to settle, then verify it's still alive (not crash-looping)
    await new Promise((r) => setTimeout(r, 8_000))
    const stableCheck = await sshRunLogged(
      target,
      `systemctl is-active ${OPENCLAW_SERVICE_NAME}`,
      currentStage,
    )
    await logSshStep(instance.id, stableCheck)
    if (stableCheck.stdout.trim() !== "active") {
      const journalSnap = await sshRunLogged(
        target,
        `journalctl -u ${OPENCLAW_SERVICE_NAME} --no-pager -n 40`,
        currentStage,
      )
      await logSshStep(instance.id, journalSnap)
      throw new Error(
        `${OPENCLAW_SERVICE_NAME} not stable after 8s (status: ${stableCheck.stdout.trim()})`,
      )
    }

    /* --- 11. Health check: is port 18789 open? ---------------------- */
    currentStage = "health_check"
    await setProvisionStage(instance.id, currentStage)

    const portDeadline = Date.now() + 60_000
    let portOpen = false
    while (Date.now() < portDeadline) {
      await new Promise((r) => setTimeout(r, 3_000))
      const portStep = await sshRunLogged(
        target,
        `ss -tlnp | grep ':${OPENCLAW_GATEWAY_PORT}' || true`,
        currentStage,
      )
      await logSshStep(instance.id, portStep)
      if (portStep.stdout.includes(`:${OPENCLAW_GATEWAY_PORT}`)) {
        portOpen = true
        break
      }
    }
    if (!portOpen) {
      const journalSnap = await sshRunLogged(
        target,
        `journalctl -u ${OPENCLAW_SERVICE_NAME} --no-pager -n 50`,
        currentStage,
      )
      await logSshStep(instance.id, journalSnap)
      throw new Error(
        `Port ${OPENCLAW_GATEWAY_PORT} never opened after 60s. Service may be crash-looping.`,
      )
    }

    await logInstanceEvent({
      instanceId: instance.id,
      stage: currentStage,
      action: "health_ok",
      result: "ok",
      message: `Port ${OPENCLAW_GATEWAY_PORT} is listening. OpenClaw is running.`,
    })

    /* --- 11. Commit state ------------------------------------------- */
    currentStage = "commit"
    await setProvisionStage(instance.id, currentStage)
    await transitionInstance(instance.id, ["provisioning"], "running", {
      set: {
        ipAddress,
        linodeId,
        containerName: OPENCLAW_SERVICE_NAME,
        containerPort: OPENCLAW_GATEWAY_PORT,
        openclawAdminEmail: adminEmail,
        openclawAdminPasswordEnc:
          instance.openclawAdminPasswordEnc ?? encryptSecret(adminPassword),
        gatewayTokenEnc: encryptSecret(gatewayToken),
        dnsStatus: instance.domain ? "pending" : null,
        tlsStatus: instance.domain ? "pending" : null,
        provisionStage: "commit",
        failedStage: null,
        lastActiveAt: new Date(),
      },
    })
    await logInstanceEvent({
      instanceId: instance.id,
      stage: "complete",
      result: "ok",
      message: `Deployment complete. Gateway at ${ipAddress}:${OPENCLAW_GATEWAY_PORT}${
        instance.domain ? ` (domain ${instance.domain})` : ""
      }. Direct access: http://${ipAddress}:${OPENCLAW_GATEWAY_PORT}`,
    })

    return {
      ipAddress,
      containerName: OPENCLAW_SERVICE_NAME,
      containerPort: OPENCLAW_GATEWAY_PORT,
      linodeId,
      mocked: false,
    }
  } catch (err) {
    // Collect diagnostics before rollback (best-effort)
    if (ipAddress) {
      try {
        await collectDiagnostics({ host: ipAddress }, instance.id)
      } catch {
        // diagnostics collection itself failed — don't mask the original error
      }
    }
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
 * 4. Persist `failedStage` on the instance row.
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
  const keepVms = process.env.KEEP_FAILED_VMS === "true"
  if (linodeId && keepVms) {
    await logInstanceEvent({
      instanceId,
      level: "warn",
      stage: "rollback",
      action: "keep_vm",
      detail: { linodeId },
      message: `KEEP_FAILED_VMS=true — VM ${linodeId} preserved for debugging. Delete manually when done.`,
    })
  } else if (linodeId) {
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

  const setFields: Record<string, unknown> = { failedStage: stage }
  if (vmDeleted) {
    setFields.linodeId = null
    setFields.ipAddress = null
  }

  await transitionInstance(instanceId, ["provisioning"], "failed_provisioning", {
    error: reason,
    set: setFields,
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
  // failed_provisioning | provisioning | failed (legacy). If already deleting/deleted, throws.
  await transitionInstance(
    instance.id,
    ["running", "stopped", "failed_provisioning", "provisioning", "failed"],
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

  // Cloudflare managed subdomain cleanup. Best-effort: a failure here must not
  // block VM deletion. Reconciler can sweep orphans later.
  if (
    process.env.CLOUDFLARE_API_TOKEN &&
    process.env.CLOUDFLARE_ZONE_ID &&
    (instance.managedSubdomain || instance.cfRecordId)
  ) {
    try {
      await deleteAgentSubdomain(instance.id, instance.cfRecordId)
      await db
        .update(instances)
        .set({ managedSubdomain: null, cfRecordId: null })
        .where(eq(instances.id, instance.id))
      await logInstanceEvent({
        instanceId: instance.id,
        stage: "delete",
        action: "cf_dns_deleted",
        message: `Cloudflare DNS record removed for ${instance.managedSubdomain ?? instance.id}.`,
      })
    } catch (cfErr) {
      await logInstanceEvent({
        instanceId: instance.id,
        level: "warn",
        stage: "delete",
        action: "cf_dns_delete",
        result: "error",
        message: `Cloudflare DNS delete failed (continuing): ${
          cfErr instanceof Error ? cfErr.message : String(cfErr)
        }`,
      })
    }
  }

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

    const gatewayToken = instance.gatewayTokenEnc
      ? decryptSecret(instance.gatewayTokenEnc)
      : generateGatewayToken()

    await sshWriteFile(
      target,
      `${OPENCLAW_DIR}/.openclaw/openclaw.json`,
      renderOpenclawConfig({
        gatewayToken,
        openRouterApiKey: OPENROUTER_API_KEY(),
        model: route.model,
        fallbackModel: route.fallback,
        domain: instance.domain,
        ipAddress: instance.ipAddress,
        soulMd: instance.soulMd,
      }),
    )
    await sshRun(target, `chown -R openclaw:openclaw '${OPENCLAW_DIR}/.openclaw'`)
    await sshWriteFile(
      target,
      `${OPENCLAW_DIR}/.env`,
      renderEnvFile(env),
      { mode: "600" },
    )
    await sshRun(target, `chown openclaw:openclaw '${OPENCLAW_DIR}/.env'`)
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
