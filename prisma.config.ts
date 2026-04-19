import { defineConfig } from "prisma/config";

// Prisma 7 requires datasource.url in this config (no longer allowed in
// schema.prisma). Prisma's CLI auto-loads .env from the project root, so
// we don't import dotenv here — that keeps this file pure TS with no extra
// runtime deps, which lets it be copied into the Docker runtime image
// without bundling dotenv.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
