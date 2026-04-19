-- AlterTable
ALTER TABLE "Instance"
  ADD COLUMN "domain" TEXT,
  ADD COLUMN "dnsStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "tlsStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "openclawAdminEmail" TEXT,
  ADD COLUMN "openclawAdminPasswordEnc" TEXT;
