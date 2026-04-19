// pm2 ecosystem file for bare-metal VPS deploys.
//
// Usage:
//   pm2 start deploy/pm2.config.cjs
//   pm2 save && pm2 startup       # persist across reboots
//
// Assumes:
//   - `npm run build` has already produced .next/standalone/server.js
//   - /etc/redesigned-giggle.env contains DATABASE_URL, AUTH_SECRET,
//     NEXTAUTH_URL, and any other runtime env (one KEY=VALUE per line).
//   - `npm run deploy:migrate` has been run against the target DB.

module.exports = {
  apps: [
    {
      name: "redesigned-giggle",
      script: ".next/standalone/server.js",
      cwd: __dirname + "/..",
      exec_mode: "fork",
      instances: 1,
      env_file: "/etc/redesigned-giggle.env",
      env: {
        NODE_ENV: "production",
        HOSTNAME: "0.0.0.0",
        PORT: "3000",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      max_memory_restart: "1G",
      kill_timeout: 10000,
      listen_timeout: 15000,
      out_file: "/var/log/redesigned-giggle/out.log",
      error_file: "/var/log/redesigned-giggle/err.log",
      merge_logs: true,
      time: true,
    },
  ],
}
