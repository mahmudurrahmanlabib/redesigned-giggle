import type { NextConfig } from "next"

const devOrigins =
  process.env.ALLOWED_DEV_ORIGINS?.split(",")
    .map((h) => h.trim())
    .filter(Boolean) ?? []

function wwwToApexRedirect():
  | {
      source: string
      has: { type: "host"; value: string }[]
      destination: string
      permanent: boolean
    }
  | undefined {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL
  if (!raw) return undefined
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`)
    const { hostname } = u
    if (
      hostname === "localhost" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("www.")
    ) {
      return undefined
    }
    return {
      source: "/:path*",
      has: [{ type: "host", value: `www.${hostname}` }],
      destination: `${u.origin}/:path*`,
      permanent: true,
    }
  } catch {
    return undefined
  }
}

const nextConfig: NextConfig = {
  ...(devOrigins.length > 0 ? { allowedDevOrigins: devOrigins } : {}),
  async redirects() {
    const apex = wwwToApexRedirect()
    return [
      { source: "/signup", destination: "/register", permanent: false },
      ...(apex ? [apex] : []),
    ]
  },
}

export default nextConfig
