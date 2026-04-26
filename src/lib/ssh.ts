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

export type SshStepResult = {
  stage: string
  command: string
  stdout: string
  stderr: string
  exitCode: number | null
  durationMs: number
  timestamp: string
}

/**
 * Instrumented SSH command runner. Wraps `sshRun` and captures structured
 * timing/output metadata for every command executed during provisioning.
 */
export async function sshRunLogged(
  target: SshTarget,
  command: string,
  stage: string,
): Promise<SshStepResult> {
  const start = Date.now()
  const result = await sshRun(target, command)
  return {
    stage,
    command,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.code,
    durationMs: Date.now() - start,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Poll until sshd is accepting connections. Cloud providers report
 * "running" before sshd binds, so this bridges the gap.
 */
export async function sshWaitReady(
  target: SshTarget,
  timeoutMs = 120_000,
  pollMs = 5_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastErr: unknown
  while (Date.now() < deadline) {
    try {
      const r = await sshRun(target, "echo ok")
      if (r.code === 0) return
    } catch (err) {
      lastErr = err
    }
    await new Promise((r) => setTimeout(r, pollMs))
  }
  throw new Error(
    `SSH not ready on ${target.host} within ${timeoutMs}ms` +
      (lastErr ? `; last error: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}` : ""),
  )
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/* ------------------------------------------------------------------ */
/* VPS bootstrap — replaces the old StackScript approach               */
/* ------------------------------------------------------------------ */

export type BootstrapOpts = {
  openclawVersion: string
  cfOriginCertPem?: string
  cfOriginKeyPem?: string
  /** Callback fired after each step for structured logging. */
  onStep?: (step: SshStepResult) => Promise<void>
}

/**
 * Full server setup over SSH. Runs each step sequentially with error
 * checking — replaces the fire-and-forget StackScript.
 */
export async function sshBootstrapVps(
  target: SshTarget,
  opts: BootstrapOpts,
): Promise<void> {
  const stage = "bootstrap"

  async function run(label: string, command: string): Promise<SshStepResult> {
    const step = await sshRunLogged(target, command, stage)
    if (opts.onStep) await opts.onStep(step)
    if (step.exitCode !== 0 && step.exitCode !== null) {
      throw new Error(`Bootstrap failed at "${label}" (exit ${step.exitCode}): ${step.stderr || step.stdout}`)
    }
    return step
  }

  await run("apt_update", "export DEBIAN_FRONTEND=noninteractive && apt-get update -y && apt-get upgrade -y")
  await run("build_deps", "export DEBIAN_FRONTEND=noninteractive && apt-get install -y ca-certificates curl gnupg ufw git build-essential")

  await run("node_setup", [
    "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
    "apt-get install -y nodejs",
    "node -v && npm -v",
  ].join(" && "))

  await run("create_user", [
    "id openclaw >/dev/null 2>&1 || useradd --system --home-dir /opt/openclaw --shell /usr/sbin/nologin openclaw",
    "mkdir -p /opt/openclaw",
    "chown -R openclaw:openclaw /opt/openclaw",
    "mkdir -p /var/tmp/openclaw-compile-cache",
    "chown openclaw:openclaw /var/tmp/openclaw-compile-cache",
  ].join(" && "))

  const ver = shellEscape(opts.openclawVersion)
  await run("install_openclaw", `SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install -g openclaw@${ver} && openclaw --version`)

  await run("install_caddy", [
    "apt-get install -y debian-keyring debian-archive-keyring apt-transport-https",
    "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg",
    "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list",
    "apt-get update -y",
    "apt-get install -y caddy",
  ].join(" && "))

  if (opts.cfOriginCertPem && opts.cfOriginKeyPem) {
    const certB64 = Buffer.from(opts.cfOriginCertPem, "utf8").toString("base64")
    const keyB64 = Buffer.from(opts.cfOriginKeyPem, "utf8").toString("base64")
    await run("cf_origin_cert", [
      "install -d -m 0750 -o caddy -g caddy /etc/caddy/cf",
      `echo ${shellEscape(certB64)} | base64 -d > /etc/caddy/cf/origin.pem`,
      `echo ${shellEscape(keyB64)} | base64 -d > /etc/caddy/cf/origin.key`,
      "chown caddy:caddy /etc/caddy/cf/origin.pem /etc/caddy/cf/origin.key",
      "chmod 0640 /etc/caddy/cf/origin.pem",
      "chmod 0600 /etc/caddy/cf/origin.key",
    ].join(" && "))

    const snippet = `*.sovereignclaw.xyz {
  tls /etc/caddy/cf/origin.pem /etc/caddy/cf/origin.key
  reverse_proxy 127.0.0.1:18789
}
`
    const snippetB64 = Buffer.from(snippet, "utf8").toString("base64")
    await run("caddy_snippet", [
      "install -d -m 0755 /etc/caddy/snippets",
      `echo ${shellEscape(snippetB64)} | base64 -d > /etc/caddy/snippets/sovereignclaw.caddy`,
    ].join(" && "))
  }

  await run("firewall", [
    "ufw allow 22/tcp || true",
    "ufw allow 80/tcp || true",
    "ufw allow 443/tcp || true",
    "yes | ufw enable || true",
  ].join(" && "))
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

/** Idempotent ufw bootstrap: allow ssh/http/https/gateway and enable. */
export async function sshConfigureUfw(target: SshTarget): Promise<SshRunResult> {
  const script = [
    "command -v ufw >/dev/null 2>&1 || (apt-get update -y && apt-get install -y ufw)",
    "ufw allow 22/tcp || true",
    "ufw allow 80/tcp || true",
    "ufw allow 443/tcp || true",
    "ufw allow 18789/tcp || true",
    "yes | ufw enable || true",
  ].join(" && ")
  return sshRun(target, script)
}
