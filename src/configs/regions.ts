// Deployment regions. Edit this list to add/remove locations across the app.
// The seed script writes these into the Region table so FKs work,
// but the wizard reads directly from this typed array.
// linodeRegion must match actual Linode API region slugs.

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
    name: "Newark",
    country: "United States (East)",
    flag: "\u{1F1FA}\u{1F1F8}",
    available: true,
    sortOrder: 10,
    linodeRegion: "us-east",
  },
  {
    slug: "us-west-1",
    name: "Fremont",
    country: "United States (West)",
    flag: "\u{1F1FA}\u{1F1F8}",
    available: true,
    sortOrder: 20,
    linodeRegion: "us-west",
  },
  {
    slug: "eu-central-1",
    name: "Frankfurt",
    country: "Germany",
    flag: "\u{1F1E9}\u{1F1EA}",
    available: true,
    sortOrder: 30,
    linodeRegion: "eu-central",
  },
  {
    slug: "eu-west-1",
    name: "London",
    country: "United Kingdom",
    flag: "\u{1F1EC}\u{1F1E7}",
    available: true,
    sortOrder: 40,
    linodeRegion: "eu-west",
  },
  {
    slug: "ap-south-1",
    name: "Singapore",
    country: "Singapore",
    flag: "\u{1F1F8}\u{1F1EC}",
    available: true,
    sortOrder: 50,
    linodeRegion: "ap-south",
  },
  {
    slug: "ap-northeast-1",
    name: "Tokyo",
    country: "Japan",
    flag: "\u{1F1EF}\u{1F1F5}",
    available: false,
    sortOrder: 60,
    linodeRegion: "ap-northeast",
  },
] as const
