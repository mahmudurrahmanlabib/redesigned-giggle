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
  // Allow literal `\n` in .env by normalizing.
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

export type DockerRunOpts = {
  image: string
  containerName: string
  hostPort: number
  containerPort?: number
  env: Record<string, string>
  restart?: "always" | "unless-stopped" | "no"
  pullFirst?: boolean
}

function shellEscape(value: string): string {
  // Single-quote and escape embedded single quotes for bash.
  return `'${value.replace(/'/g, `'\\''`)}'`
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

/**
 * Write a file on the remote host. Creates parent dirs. Uses heredoc over
 * ssh so we don't need scp on the target. Contents are base64-encoded in
 * transit to preserve arbitrary bytes (including quotes and newlines).
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

/** Run `docker compose up -d` in the given directory on the remote host. */
export async function sshComposeUp(target: SshTarget, dir: string): Promise<SshRunResult> {
  return sshRun(
    target,
    `cd ${shellEscape(dir)} && docker compose pull && docker compose up -d --remove-orphans`
  )
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
