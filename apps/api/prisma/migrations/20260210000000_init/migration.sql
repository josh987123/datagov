-- CreateEnum
CREATE TYPE "IngestRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "Agency" (
    "id" SERIAL NOT NULL,
    "ckanId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dataset" (
    "id" SERIAL NOT NULL,
    "ckanId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "metadataCreated" TIMESTAMP(3),
    "metadataModified" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "organizationId" INTEGER,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetTag" (
    "datasetId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,
    CONSTRAINT "DatasetTag_pkey" PRIMARY KEY ("datasetId","tagId")
);

-- CreateTable
CREATE TABLE "IngestRun" (
    "id" SERIAL NOT NULL,
    "status" "IngestRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "totalFromSource" INTEGER,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "insertedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    CONSTRAINT "IngestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailySnapshot" (
    "id" SERIAL NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "totalDatasets" INTEGER NOT NULL,
    "datasetsAdded7d" INTEGER NOT NULL,
    "datasetsAdded30d" INTEGER NOT NULL,
    "lastIngestRunId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DailySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyAgencySnapshot" (
    "id" SERIAL NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "agencyId" INTEGER NOT NULL,
    "datasetCount" INTEGER NOT NULL,
    CONSTRAINT "DailyAgencySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agency_ckanId_key" ON "Agency"("ckanId");

-- CreateIndex
CREATE UNIQUE INDEX "Agency_name_key" ON "Agency"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Dataset_ckanId_key" ON "Dataset"("ckanId");

-- CreateIndex
CREATE INDEX "Dataset_metadataModified_idx" ON "Dataset"("metadataModified");

-- CreateIndex
CREATE INDEX "Dataset_organizationId_idx" ON "Dataset"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "DatasetTag_tagId_idx" ON "DatasetTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "DailySnapshot_snapshotDate_key" ON "DailySnapshot"("snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAgencySnapshot_snapshotDate_agencyId_key" ON "DailyAgencySnapshot"("snapshotDate", "agencyId");

-- CreateIndex
CREATE INDEX "DailyAgencySnapshot_agencyId_snapshotDate_idx" ON "DailyAgencySnapshot"("agencyId", "snapshotDate");

-- AddForeignKey
ALTER TABLE "Dataset" ADD CONSTRAINT "Dataset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetTag" ADD CONSTRAINT "DatasetTag_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetTag" ADD CONSTRAINT "DatasetTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySnapshot" ADD CONSTRAINT "DailySnapshot_lastIngestRunId_fkey" FOREIGN KEY ("lastIngestRunId") REFERENCES "IngestRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAgencySnapshot" ADD CONSTRAINT "DailyAgencySnapshot_snapshotDate_fkey" FOREIGN KEY ("snapshotDate") REFERENCES "DailySnapshot"("snapshotDate") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAgencySnapshot" ADD CONSTRAINT "DailyAgencySnapshot_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
