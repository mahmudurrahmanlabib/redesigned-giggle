// Deployment regions. Edit this list to add/remove locations across the app.
// The seed script writes these into the Region table so FKs work,
// but the wizard reads directly from this typed array.

export type RegionConfig = {
  slug: string
  name: string
  country: string
  flag: string
  available: boolean
  sortOrder: number
  linodeRegion: string
}

export const REGIONS: readonly RegionConfig[] = [
  {
    slug: "us-east-1",
    name: "Ashburn",
    country: "United States (East)",
    flag: "🇺🇸",
    available: true,
    sortOrder: 10,
    linodeRegion: "us-east",
  },
  {
    slug: "us-west-1",
    name: "Hillsboro",
    country: "United States (West)",
    flag: "🇺🇸",
    available: true,
    sortOrder: 20,
    linodeRegion: "us-west",
  },
  {
    slug: "eu-central-1",
    name: "Frankfurt",
    country: "Germany",
    flag: "🇩🇪",
    available: true,
    sortOrder: 30,
    linodeRegion: "eu-central",
  },
  {
    slug: "eu-west-1",
    name: "Helsinki",
    country: "Finland",
    flag: "🇫🇮",
    available: true,
    sortOrder: 40,
    linodeRegion: "eu-central",
  },
  {
    slug: "ap-southeast-1",
    name: "Singapore",
    country: "Singapore",
    flag: "🇸🇬",
    available: true,
    sortOrder: 50,
    linodeRegion: "ap-south",
  },
  {
    slug: "ap-northeast-1",
    name: "Tokyo",
    country: "Japan",
    flag: "🇯🇵",
    available: false,
    sortOrder: 60,
    linodeRegion: "ap-northeast",
  },
] as const
