// Deployment regions. Edit this list to add/remove locations across the app.
// The seed script writes these into the Region table so Prisma FKs work,
// but the wizard reads directly from this typed array.

export type RegionConfig = {
  slug: string
  name: string
  country: string
  flag: string
  available: boolean
  sortOrder: number
}

export const REGIONS: readonly RegionConfig[] = [
  {
    slug: "us-east-1",
    name: "Ashburn",
    country: "United States (East)",
    flag: "🇺🇸",
    available: true,
    sortOrder: 10,
  },
  {
    slug: "us-west-1",
    name: "Hillsboro",
    country: "United States (West)",
    flag: "🇺🇸",
    available: true,
    sortOrder: 20,
  },
  {
    slug: "eu-central-1",
    name: "Frankfurt",
    country: "Germany",
    flag: "🇩🇪",
    available: true,
    sortOrder: 30,
  },
  {
    slug: "eu-west-1",
    name: "Helsinki",
    country: "Finland",
    flag: "🇫🇮",
    available: true,
    sortOrder: 40,
  },
  {
    slug: "ap-southeast-1",
    name: "Singapore",
    country: "Singapore",
    flag: "🇸🇬",
    available: true,
    sortOrder: 50,
  },
  {
    slug: "ap-northeast-1",
    name: "Tokyo",
    country: "Japan",
    flag: "🇯🇵",
    available: false, // soon
    sortOrder: 60,
  },
] as const
