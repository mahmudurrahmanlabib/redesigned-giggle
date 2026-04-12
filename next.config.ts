import type { NextConfig } from "next"

const devOrigins =
  process.env.ALLOWED_DEV_ORIGINS?.split(",")
    .map((h) => h.trim())
    .filter(Boolean) ?? []

const nextConfig: NextConfig = {
  ...(devOrigins.length > 0 ? { allowedDevOrigins: devOrigins } : {}),
  async redirects() {
    return [{ source: "/signup", destination: "/register", permanent: false }]
  },
}

export default nextConfig
