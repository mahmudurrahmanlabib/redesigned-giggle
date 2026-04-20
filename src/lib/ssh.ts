import { NodeSSH } from "node-ssh"

export type SshTarget = {
  host: string
  username?: string
}

function loadPrivateKey(): string {
  const raw = process.env.SSH_FLEET_PRIVATE_KEY
  if (!raw) {
    throw new Error("SSH_FLEET_PRIVATE_KEY is not set")
  }
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw
}

async function connect(target: SshTarget): Promise<NodeSSH> {
  const ssh = new NodeSSH()
  await ssh.connect({
    host: target.host,
    username: target.username ?? "root",
    privateKey: loadPrivateKey(),
    readyTimeout: 20_000,
  })
  return ssh
}

export type SshRunResult = { stdout: string; stderr: string; code: number | null }

/** Run an arbitrary command on a host. Throws if the SSH connect itself fails. */
export async function sshRun(target: SshTarget, command: string): Promise<SshRunResult> {
  const ssh = await connect(target)
  try {
    const r = await ssh.execCommand(command)
    return { stdout: r.stdout, stderr: r.stderr, code: r.code ?? null }
  } finally {
    ssh.dispose()
  }
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/**
 * Wait for StackScript to finish installing OpenClaw.
 * Polls `openclaw --version` over SSH until it succeeds or timeout.
 */
export async function sshWaitForOpenclaw(
  target: SshTarget,
  timeoutMs = 300_000,
  pollMs = 5_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastErr: unknown
  while (Date.now() < deadline) {
    try {
      const r = await sshRun(target, "command -v openclaw >/dev/null && openclaw --version")
      if (r.code === 0) return
    } catch (err) {
      lastErr = err
    }
    await new Promise((r) => setTimeout(r, pollMs))
  }
  throw new Error(
    `openclaw never became available on ${target.host} within ${timeoutMs}ms` +
      (lastErr ? `; last ssh error: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}` : ""),
  )
}

/**
 * Phase 5 hard gate: run OpenClaw in the background, verify it responds
 * to a health check on loopback, then kill the test process.
 * Validates the binary works before systemd is involved.
 */
export async function sshValidateOpenclawBinary(
  target: SshTarget,
  port: number,
  timeoutSec = 10,
): Promise<void> {
  const startCmd = [
    `sudo -u openclaw bash -c 'OPENCLAW_GATEWAY_PORT=${port} openclaw gateway &'`,
    `sleep ${timeoutSec}`,
    `curl -sf http://127.0.0.1:${port}/health`,
  ].join(" && ")
  const killCmd = `pkill -f 'openclaw gateway' || true`

  try {
    const result = await sshRun(target, startCmd)
    if (result.code !== 0 && result.code !== null) {
      throw new Error(
        `OpenClaw binary validation failed (exit ${result.code}): ${result.stderr || result.stdout}`,
      )
    }
  } finally {
    await sshRun(target, killCmd).catch(() => {})
  }
}

/* ------------------------------------------------------------------ */
/* systemctl helpers                                                    */
/* ------------------------------------------------------------------ */

export async function sshSystemctlStart(target: SshTarget, service: string): Promise<SshRunResult> {
  return sshRun(target, `systemctl start ${shellEscape(service)}`)
}

export async function sshSystemctlStop(target: SshTarget, service: string): Promise<SshRunResult> {
  return sshRun(target, `systemctl stop ${shellEscape(service)}`)
}

export async function sshSystemctlRestart(target: SshTarget, service: string): Promise<SshRunResult> {
  return sshRun(target, `systemctl restart ${shellEscape(service)}`)
}

export async function sshSystemctlEnable(target: SshTarget, service: string): Promise<SshRunResult> {
  return sshRun(target, `systemctl enable ${shellEscape(service)}`)
}

export async function sshSystemctlStatus(target: SshTarget, service: string): Promise<SshRunResult> {
  return sshRun(target, `systemctl is-active ${shellEscape(service)}`)
}

/**
 * Write Caddyfile and reload the Caddy service.
 */
export async function sshInstallCaddyfile(target: SshTarget, content: string): Promise<SshRunResult> {
  const writeResult = await sshWriteFile(target, "/etc/caddy/Caddyfile", content)
  if (writeResult.code !== 0 && writeResult.code !== null) return writeResult
  return sshRun(target, "systemctl reload caddy")
}

/* ------------------------------------------------------------------ */
/* Docker helpers (shared-cluster path only; VPS uses systemd above)   */
/* ------------------------------------------------------------------ */

export type DockerRunOpts = {
  image: string
  containerName: string
  hostPort: number
  containerPort?: number
  env: Record<string, string>
  restart?: "always" | "unless-stopped" | "no"
  pullFirst?: boolean
}

function buildDockerRunCmd(opts: DockerRunOpts): string {
  const envFlags = Object.entries(opts.env)
    .map(([k, v]) => `-e ${shellEscape(`${k}=${v}`)}`)
    .join(" ")
  const restart = opts.restart ?? "unless-stopped"
  const containerPort = opts.containerPort ?? 3000
  return [
    "docker run -d",
    `--name ${shellEscape(opts.containerName)}`,
    `--restart ${restart}`,
    `-p ${opts.hostPort}:${containerPort}`,
    envFlags,
    shellEscape(opts.image),
  ].join(" ")
}

/** Pull-then-run. On name collision we rm -f first so retries succeed. */
export async function sshDockerRun(target: SshTarget, opts: DockerRunOpts): Promise<SshRunResult> {
  const ssh = await connect(target)
  try {
    if (opts.pullFirst !== false) {
      await ssh.execCommand(`docker pull ${shellEscape(opts.image)}`)
    }
    await ssh.execCommand(`docker rm -f ${shellEscape(opts.containerName)} || true`)
    const r = await ssh.execCommand(buildDockerRunCmd(opts))
    return { stdout: r.stdout, stderr: r.stderr, code: r.code ?? null }
  } finally {
    ssh.dispose()
  }
}

export async function sshDockerStop(target: SshTarget, containerName: string): Promise<SshRunResult> {
  return sshRun(target, `docker stop ${shellEscape(containerName)}`)
}

export async function sshDockerStart(target: SshTarget, containerName: string): Promise<SshRunResult> {
  return sshRun(target, `docker start ${shellEscape(containerName)}`)
}

export async function sshDockerRestart(target: SshTarget, containerName: string): Promise<SshRunResult> {
  return sshRun(target, `docker restart ${shellEscape(containerName)}`)
}

export async function sshDockerRm(target: SshTarget, containerName: string): Promise<SshRunResult> {
  return sshRun(target, `docker rm -f ${shellEscape(containerName)}`)
}

/* ------------------------------------------------------------------ */
/* file + firewall helpers (unchanged)                                 */
/* ------------------------------------------------------------------ */

/**
 * Write a file on the remote host. Creates parent dirs. Contents are
 * base64-encoded in transit to preserve arbitrary bytes.
 */
export async function sshWriteFile(
  target: SshTarget,
  remotePath: string,
  contents: string,
  opts: { mode?: string } = {}
): Promise<SshRunResult> {
  const b64 = Buffer.from(contents, "utf8").toString("base64")
  const dir = remotePath.replace(/\/[^/]+$/, "") || "/"
  const cmd = [
    `mkdir -p ${shellEscape(dir)}`,
    `echo ${shellEscape(b64)} | base64 -d > ${shellEscape(remotePath)}`,
    opts.mode ? `chmod ${opts.mode} ${shellEscape(remotePath)}` : null,
  ]
    .filter(Boolean)
    .join(" && ")
  return sshRun(target, cmd)
}

/** Idempotent ufw bootstrap: allow ssh/http/https and enable. */
export async function sshConfigureUfw(target: SshTarget): Promise<SshRunResult> {
  const script = [
    "command -v ufw >/dev/null 2>&1 || (apt-get update -y && apt-get install -y ufw)",
    "ufw allow 22/tcp || true",
    "ufw allow 80/tcp || true",
    "ufw allow 443/tcp || true",
    "yes | ufw enable || true",
  ].join(" && ")
  return sshRun(target, script)
}
