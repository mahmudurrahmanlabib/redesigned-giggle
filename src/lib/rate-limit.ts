const requests = new Map<string, number[]>()

export function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now()
  const timestamps = requests.get(key) || []
  const filtered = timestamps.filter((t) => now - t < windowMs)

  if (filtered.length >= maxRequests) {
    return false
  }

  filtered.push(now)
  requests.set(key, filtered)
  return true
}
