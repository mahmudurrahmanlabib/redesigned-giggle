import type { InferSelectModel } from "drizzle-orm"
import { db, instances, instanceLogs, regions, serverConfigs, eq } from "@/db"
import {
  logInstanceEvent,
  transitionInstance,
  withInstanceLock,
} from "@/lib/instance-state"
import { allocatePort, FleetEmptyError, FleetFullError, pickHost } from "@/lib/host-scheduler"
import {
  sshBootstrapVps,
  sshDockerRestart,
  sshDockerRm,
  sshDockerRun,
  sshDockerStart,
  sshDockerStop,
  sshRun,
  sshRunLogged,
  sshRunScriptLogged,
  sshVmHasCloudflareOriginCerts,
  type SshStepResult,
  sshSystemctlRestart,
  sshSystemctlStart,
  sshSystemctlStop,
  sshWaitReady,
  type SshTarget,
} from "@/lib/ssh"
import { decryptSecret, encryptSecret } from "@/lib/crypto-secret"
import {
  buildOpenclawEnv,
  generateAdminPassword,
  generateGatewayToken,
  OPENCLAW_GATEWAY_PORT,
  OPENCLAW_SERVICE_NAME,
  OPENCLAW_VERSION,
  OPENCLAW_VPS_MIN_NODE,
  renderCaddyfile,
  renderEnvFile,
  renderOpenclawConfig,
  renderSystemdUnit,
} from "@/lib/openclaw"
import { buildGatewayAllowedOrigins } from "@/lib/instance-gateway-access"
import { getVmProvider, describeVmError } from "@/lib/vm-provider"
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

const FALLBACK_REGION = "us-east"
const FALLBACK_PLAN = "g6-standard-2"

const OPENCLAW_DIR = "/opt/openclaw"

function shouldSkipOpenclawOnboard(): boolean {
  return (
    process.env.SKIP_OPENCLAW_ONBOARD === "1" || process.env.OPENCLAW_ONBOARD === "0"
  )
}

function bashSingleQuoteForScript(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}

function openclawCliArgs(...args: string[]): string {
  return args.map(bashSingleQuoteForScript).join(" ")
}

function buildVpsPostBootstrapBurstScript(opts: {
  envB64: string
  caddyB64: string
  unitB64: string
  skipOnboard: boolean
  /** argv after `openclaw` binary, one `config set` per row */
  openclawConfigArgss: string[][]
}): string {
  const skipFlag = opts.skipOnboard ? "1" : "0"
  const configLines = opts.openclawConfigArgss
    .map(
      (argv) =>
        `sudo -u openclaw HOME=${bashSingleQuoteForScript(OPENCLAW_DIR)} /usr/bin/openclaw ${openclawCliArgs(...argv)} 2>&1 || exit 1`,
    )
    .join("\n")

  return `#!/bin/bash
set -uo pipefail
OC_HOME=${bashSingleQuoteForScript(OPENCLAW_DIR)}
SERVICE=${bashSingleQuoteForScript(OPENCLAW_SERVICE_NAME)}
PORT=${bashSingleQuoteForScript(String(OPENCLAW_GATEWAY_PORT))}

echo "=== provision: write_env ==="
echo ${bashSingleQuoteForScript(opts.envB64)} | base64 -d > "\${OC_HOME}/.env" || exit 1
chmod 600 "\${OC_HOME}/.env"
chown openclaw:openclaw "\${OC_HOME}/.env"

echo "=== provision: onboard ==="
ONBOARD_EC=0
if [ "${skipFlag}" = "1" ]; then
  echo "provision: onboard skipped (SKIP_OPENCLAW_ONBOARD=1 or OPENCLAW_ONBOARD=0)"
else
  set +e
  sudo -u openclaw HOME="\${OC_HOME}" /usr/bin/openclaw onboard --mode local --yes 2>&1
  ONBOARD_EC=$?
  set -e
fi
echo "onboard_exit:\${ONBOARD_EC}"

set -e
echo "=== provision: config ==="
${configLines}

echo "=== provision: config_dump ==="
cat "\${OC_HOME}/.openclaw/openclaw.json" 2>/dev/null || echo "no config file"

echo "=== provision: caddy ==="
echo ${bashSingleQuoteForScript(opts.caddyB64)} | base64 -d > /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy

echo "=== provision: systemd ==="
echo ${bashSingleQuoteForScript(opts.unitB64)} | base64 -d > "/etc/systemd/system/\${SERVICE}.service"
systemctl daemon-reload
systemctl enable "\${SERVICE}"
systemctl start "\${SERVICE}"

echo "=== provision: wait_active ==="
ACTIVE_OK=0
for _ in \$(seq 1 20); do
  if systemctl is-active --quiet "\${SERVICE}"; then
    ACTIVE_OK=1
    break
  fi
  sleep 1
done
if [ "\${ACTIVE_OK}" != "1" ]; then
  systemctl is-active "\${SERVICE}" || true
  journalctl -u "\${SERVICE}" --no-pager -n 40
  exit 1
fi

echo "=== provision: wait_port ==="
PORT_OK=0
for _ in \$(seq 1 60); do
  if ss -tlnp 2>/dev/null | grep -q ":\${PORT}"; then
    PORT_OK=1
    break
  fi
  sleep 1
done
if [ "\${PORT_OK}" != "1" ]; then
  journalctl -u "\${SERVICE}" --no-pager -n 50
  exit 1
fi

echo "=== provision: done ==="
`
}

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

async function waitForVmRunning(vmId: string, timeoutMs = 180_000): Promise<string> {
  const provider = getVmProvider()
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const vm = await provider.getVM(vmId)
    if (vm.status === "running" && vm.ipv4?.[0]) {
      return vm.ipv4[0]
    }
    await new Promise((r) => setTimeout(r, 5_000))
  }
  throw new Error(`VM ${vmId} did not reach "running" within ${timeoutMs}ms`)
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
  vmId?: string
  mocked: boolean
}

export async function provisionBot(instance: Instance): Promise<ProvisionResult> {
  const target = instance.deploymentTarget ?? "shared"

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
    const reason =
      err instanceof FleetEmptyError || err instanceof FleetFullError
        ? err.message
        : describeVmError(err)
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
  "bootstrap",
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

async function logSshStep(instanceId: string, step: SshStepResult): Promise<void> {
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

async function collectDiagnostics(
  target: SshTarget,
  instanceId: string,
): Promise<void> {
  const commands: [string, string][] = [
    [`journalctl -u ${OPENCLAW_SERVICE_NAME} --no-pager -n 200`, "journal"],
    ["dmesg -T 2>/dev/null | tail -40 || true", "kernel_tail"],
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
  const provider = getVmProvider()
  const [region, serverConfig] = await Promise.all([
    db.query.regions.findFirst({ where: eq(regions.id, instance.regionId) }),
    db.query.serverConfigs.findFirst({ where: eq(serverConfigs.id, instance.serverConfigId) }),
  ])
  const providerRegion = region?.providerRegion ?? FALLBACK_REGION
  const providerPlan = serverConfig?.providerPlan ?? FALLBACK_PLAN

  let vmId: string | undefined = instance.vmId ?? undefined
  let ipAddress: string | undefined = instance.ipAddress ?? undefined
  let currentStage: VpsStage = "create_vm"

  try {
    /* --- 1. Create VM ------------------------------------------------ */
    currentStage = "create_vm"
    await setProvisionStage(instance.id, currentStage)
    if (!vmId) {
      await logInstanceEvent({
        instanceId: instance.id,
        stage: currentStage,
        message: `Creating VM (${providerPlan} in ${providerRegion})...`,
      })

      const publicKey = process.env.SSH_FLEET_PUBLIC_KEY
      const rootPassword = generateRootPassword()
      const vm = await provider.createVM({
        label: `sovereign-vps-${instance.id.slice(0, 8)}`,
        plan: providerPlan,
        region: providerRegion,
        rootPassword,
        authorizedKeys: publicKey ? [publicKey] : undefined,
        tags: ["sovereignml", "openclaw", "vps"],
      })
      vmId = vm.id

      await db
        .update(instances)
        .set({ vmId, rootPasswordEnc: encryptSecret(rootPassword) })
        .where(eq(instances.id, instance.id))

      await logInstanceEvent({
        instanceId: instance.id,
        stage: currentStage,
        action: "vm_created",
        result: "ok",
        detail: { vmId },
        message: `VM ${vmId} created. Waiting for boot...`,
      })
    }

    /* --- 2. Wait for boot ------------------------------------------- */
    currentStage = "wait_boot"
    await setProvisionStage(instance.id, currentStage)
    if (!ipAddress) {
      ipAddress = await waitForVmRunning(vmId!)
      await db
        .update(instances)
        .set({ ipAddress })
        .where(eq(instances.id, instance.id))
    }

    /* --- 2b. Cloudflare managed subdomain --------------------------- */
    let managedSubdomainForProvision: string | null = instance.managedSubdomain ?? null
    if (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ZONE_ID) {
      try {
        const { name, recordId } = await createAgentSubdomain(
          instance.id,
          ipAddress,
          instance.name,
        )
        managedSubdomainForProvision = name
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

    /* --- 4. Bootstrap (install Node, OpenClaw, Caddy over SSH) ------- */
    currentStage = "bootstrap"
    await setProvisionStage(instance.id, currentStage)
    await logInstanceEvent({
      instanceId: instance.id,
      stage: currentStage,
      message: "Bootstrapping server (Node, OpenClaw, Caddy)...",
    })
    await sshBootstrapVps(target, {
      openclawVersion: OPENCLAW_VERSION(),
      minNodeVersion: OPENCLAW_VPS_MIN_NODE,
      cfOriginCertPem: process.env.CLOUDFLARE_ORIGIN_CERT_PEM,
      cfOriginKeyPem: process.env.CLOUDFLARE_ORIGIN_CERT_KEY,
    })
    await logInstanceEvent({
      instanceId: instance.id,
      stage: currentStage,
      action: "bootstrap_complete",
      result: "ok",
      message: "Server bootstrap complete. All dependencies installed.",
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

    const useCfOriginTls =
      Boolean(managedSubdomainForProvision) && (await sshVmHasCloudflareOriginCerts(target))
    if (managedSubdomainForProvision && !useCfOriginTls) {
      await logInstanceEvent({
        instanceId: instance.id,
        stage: currentStage,
        level: "warn",
        message:
          "Managed hostname DNS is set but VM has no /etc/caddy/cf origin certificate. Use Cloudflare SSL → Flexible (HTTP to origin), or provision with CLOUDFLARE_ORIGIN_CERT_PEM and CLOUDFLARE_ORIGIN_CERT_KEY so Full (strict) works on port 443.",
      })
    }

    const caddyContent = renderCaddyfile({
      domain: instance.domain,
      managedSubdomain: managedSubdomainForProvision,
      useCfOriginTls,
    })
    const caddyB64 = Buffer.from(caddyContent, "utf8").toString("base64")

    const unitContent = renderSystemdUnit()
    const unitB64 = Buffer.from(unitContent, "utf8").toString("base64")

    const allowedOrigins = buildGatewayAllowedOrigins({
      domain: instance.domain,
      managedSubdomain: managedSubdomainForProvision,
      ipAddress,
      tlsStatus: instance.domain ? instance.tlsStatus : null,
    })

    const openclawConfigArgss: string[][] = [
      ["config", "set", "gateway.port", String(OPENCLAW_GATEWAY_PORT)],
      ["config", "set", "gateway.bind", "localhost"],
      ["config", "set", "gateway.auth.token", JSON.stringify(gatewayToken)],
      ["config", "set", "gateway.remote.token", JSON.stringify(gatewayToken)],
      ["config", "set", "gateway.trustedProxies", '["127.0.0.1"]'],
      ["config", "set", "gateway.controlUi.allowedOrigins", JSON.stringify(allowedOrigins)],
      ["config", "set", "gateway.controlUi.allowInsecureAuth", "true"],
      ["config", "set", "gateway.controlUi.dangerouslyDisableDeviceAuth", "true"],
      ["config", "set", "agents.defaults.model.primary", JSON.stringify(route.model)],
      ["config", "set", "agents.defaults.model.fallbacks", JSON.stringify([route.fallback])],
    ]

    const skipOnboard = shouldSkipOpenclawOnboard()
    const burstScript = buildVpsPostBootstrapBurstScript({
      envB64,
      caddyB64,
      unitB64,
      skipOnboard,
      openclawConfigArgss,
    })

    const burstStep = await sshRunScriptLogged(
      target,
      burstScript,
      currentStage,
      "provision:burst (env, onboard, config, caddy, systemd, health)",
    )
    await logSshStep(instance.id, burstStep)

    const onboardExitLine = burstStep.stdout
      .split("\n")
      .find((line) => line.startsWith("onboard_exit:"))
    const onboardExit = onboardExitLine
      ? parseInt(onboardExitLine.slice("onboard_exit:".length), 10)
      : 0
    if (!skipOnboard && Number.isFinite(onboardExit) && onboardExit !== 0) {
      await logInstanceEvent({
        instanceId: instance.id,
        level: "warn",
        stage: currentStage,
        action: "onboard_failed",
        message: `openclaw onboard failed (exit ${onboardExit}), continued with config set...`,
      })
    }

    if (burstStep.exitCode !== 0 && burstStep.exitCode !== null) {
      throw new Error(
        `Provision burst failed (exit ${burstStep.exitCode}): ${burstStep.stderr || burstStep.stdout}`,
      )
    }

    currentStage = "installing_service"
    await setProvisionStage(instance.id, currentStage)
    currentStage = "starting_service"
    await setProvisionStage(instance.id, currentStage)
    currentStage = "health_check"
    await setProvisionStage(instance.id, currentStage)

    await logInstanceEvent({
      instanceId: instance.id,
      stage: currentStage,
      action: "health_ok",
      result: "ok",
      message: `Port ${OPENCLAW_GATEWAY_PORT} is listening. OpenClaw is running.`,
    })

    /* --- 12. Commit state ------------------------------------------- */
    currentStage = "commit"
    await setProvisionStage(instance.id, currentStage)
    await transitionInstance(instance.id, ["provisioning"], "running", {
      set: {
        ipAddress,
        vmId,
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
      vmId,
      mocked: false,
    }
  } catch (err) {
    if (ipAddress) {
      try {
        await collectDiagnostics({ host: ipAddress }, instance.id)
      } catch {
        // diagnostics collection itself failed — don't mask the original error
      }
    }
    await rollbackProvisioning(instance.id, vmId, currentStage, err)
    throw err
  }
}

async function rollbackProvisioning(
  instanceId: string,
  vmId: string | undefined,
  stage: string,
  err: unknown,
): Promise<void> {
  const reason = describeVmError(err)
  await logInstanceEvent({
    instanceId,
    level: "error",
    stage,
    action: "failed",
    result: "error",
    detail: { vmId },
    message: `Provisioning failed at ${stage}: ${reason}`,
  })

  let vmDeleted = false
  const keepVms = process.env.KEEP_FAILED_VMS === "true"
  if (vmId && keepVms) {
    await logInstanceEvent({
      instanceId,
      level: "warn",
      stage: "rollback",
      action: "keep_vm",
      detail: { vmId },
      message: `KEEP_FAILED_VMS=true — VM ${vmId} preserved for debugging. Delete manually when done.`,
    })
  } else if (vmId) {
    const provider = getVmProvider()
    const backoffMs = [1_000, 4_000, 16_000]
    for (let i = 0; i < backoffMs.length; i++) {
      try {
        await provider.deleteVM(vmId)
        vmDeleted = true
        break
      } catch (delErr) {
        await logInstanceEvent({
          instanceId,
          level: "warn",
          stage: "rollback",
          action: "delete_vm_retry",
          result: "error",
          detail: { vmId, attempt: i + 1 },
          message: `deleteVM retry ${i + 1} failed: ${describeVmError(delErr)}`,
        })
        if (i < backoffMs.length - 1) {
          await new Promise((r) => setTimeout(r, backoffMs[i]))
        }
      }
    }
  }

  const setFields: Record<string, unknown> = { failedStage: stage }
  if (vmDeleted) {
    setFields.vmId = null
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
    detail: { vmId },
    message: vmDeleted
      ? `Rollback complete. VM ${vmId} deleted.`
      : `Rollback incomplete. VM ${vmId} still exists — awaiting reconciler.`,
  })
}

/* ------------------------------------------------------------------ */
/* lifecycle                                                           */
/* ------------------------------------------------------------------ */

export async function restartBot(instance: Instance): Promise<void> {
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

export type DeleteResult = { status: "deleted" | "pending"; vmId?: string }

export async function deleteBot(instance: Instance): Promise<DeleteResult> {
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
          message: `docker rm failed (continuing): ${describeVmError(err)}`,
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

  if (!isLiveMode() || !instance.vmId) {
    await transitionInstance(instance.id, ["deleting"], "deleted", {
      set: { ipAddress: null, vmId: null },
    })
    await logInstanceEvent({
      instanceId: instance.id,
      level: "warn",
      stage: "delete",
      action: "completed",
      result: "ok",
      message: "Instance deleted (no VM to clean up).",
    })
    return { status: "deleted" }
  }

  const provider = getVmProvider()
  const vmId = instance.vmId
  const backoffMs = [1_000, 4_000, 16_000, 60_000, 300_000]
  let lastErr: unknown = null

  for (let i = 0; i < backoffMs.length; i++) {
    try {
      const deleted = await provider.deleteVM(vmId)
      const after = await provider.getVMOrNull(vmId)
      if (after == null || deleted) {
        await transitionInstance(instance.id, ["deleting"], "deleted", {
          set: { ipAddress: null, vmId: null },
        })
        await logInstanceEvent({
          instanceId: instance.id,
          level: "warn",
          stage: "delete",
          action: "completed",
          result: "ok",
          detail: { vmId, attempts: i + 1 },
          message: `VM ${vmId} deleted and verified gone.`,
        })
        return { status: "deleted", vmId }
      }
      lastErr = new Error(`VM ${vmId} still present after DELETE`)
    } catch (err) {
      lastErr = err
    }
    await logInstanceEvent({
      instanceId: instance.id,
      level: "warn",
      stage: "delete",
      action: "retry",
      result: "error",
      detail: { vmId, attempt: i + 1 },
      message: `deleteVM attempt ${i + 1} failed: ${describeVmError(lastErr)}`,
    })
    if (i < backoffMs.length - 1) {
      await new Promise((r) => setTimeout(r, backoffMs[i]))
    }
  }

  await db
    .update(instances)
    .set({ lastError: `delete retries exhausted: ${describeVmError(lastErr)}` })
    .where(eq(instances.id, instance.id))
  await logInstanceEvent({
    instanceId: instance.id,
    level: "error",
    stage: "delete",
    action: "pending_reconciler",
    result: "error",
    detail: { vmId },
    message: `VM delete failed after ${backoffMs.length} retries. Reconciler will sweep.`,
  })
  return { status: "pending", vmId }
}

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

    const { sshWriteFile } = await import("@/lib/ssh")
    await sshWriteFile(
      target,
      `${OPENCLAW_DIR}/.openclaw/openclaw.json`,
      renderOpenclawConfig({
        gatewayToken,
        openRouterApiKey: OPENROUTER_API_KEY(),
        model: route.model,
        fallbackModel: route.fallback,
        domain: instance.domain,
        managedSubdomain: instance.managedSubdomain,
        ipAddress: instance.ipAddress,
        tlsStatus: instance.tlsStatus,
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
