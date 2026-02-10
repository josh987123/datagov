-- CreateEnum
CREATE TYPE "LinkHealthStatus" AS ENUM ('UNKNOWN', 'HEALTHY', 'BROKEN');

-- AlterTable
ALTER TABLE "Dataset"
ADD COLUMN "resourceCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "tagCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "hasOpenFormat" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "hasApiResource" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "hasDescription" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "hasLicense" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "freshnessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "opennessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "daysSinceModified" INTEGER,
ADD COLUMN "linkStatus" "LinkHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "linkCheckedAt" TIMESTAMP(3),
ADD COLUMN "linkHttpStatus" INTEGER;

-- AlterTable
ALTER TABLE "DailySnapshot"
ADD COLUMN "netDatasetChange" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "avgQualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "avgOpennessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "staleDatasetCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "staleDatasetShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "openFormatShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "apiResourceShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "brokenLinkCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Dataset_qualityScore_idx" ON "Dataset"("qualityScore");

-- CreateIndex
CREATE INDEX "Dataset_opennessScore_idx" ON "Dataset"("opennessScore");

-- CreateIndex
CREATE INDEX "Dataset_daysSinceModified_idx" ON "Dataset"("daysSinceModified");

-- CreateIndex
CREATE INDEX "Dataset_linkStatus_idx" ON "Dataset"("linkStatus");
