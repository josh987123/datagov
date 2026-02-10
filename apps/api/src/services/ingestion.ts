import type { IngestRunSummary } from "@datagov/shared";
import { prisma } from "../db.js";
import { env } from "../config.js";
import {
  extractSourceUrl,
  fetchPackagePage,
  normalizeAgencyName,
  normalizeTagName,
  parseDate
} from "./ckan.js";
import { mapIngestRun } from "./serializers.js";
import { startOfUtcDay, subtractDays } from "../utils/date.js";

interface RunIngestionOptions {
  pageSize?: number;
  maxPages?: number;
}

async function getOrCreateAgencyId(
  agencyName: string,
  ckanAgencyId: string | undefined,
  cache: Map<string, number>
): Promise<number> {
  const cached = cache.get(agencyName);
  if (cached) {
    return cached;
  }

  const agency = await prisma.agency.upsert({
    where: { name: agencyName },
    update: ckanAgencyId ? { ckanId: ckanAgencyId } : {},
    create: {
      name: agencyName,
      ckanId: ckanAgencyId ?? null
    }
  });

  cache.set(agencyName, agency.id);
  return agency.id;
}

async function getOrCreateTagId(tagName: string, cache: Map<string, number>): Promise<number> {
  const cached = cache.get(tagName);
  if (cached) {
    return cached;
  }

  const tag = await prisma.tag.upsert({
    where: { name: tagName },
    update: {},
    create: { name: tagName }
  });

  cache.set(tagName, tag.id);
  return tag.id;
}

async function recordDailySnapshots(ingestRunId: number): Promise<void> {
  const now = new Date();
  const snapshotDate = startOfUtcDay(now);
  const last7Cutoff = subtractDays(now, 7);
  const last30Cutoff = subtractDays(now, 30);

  const [totalDatasets, datasetsAdded7d, datasetsAdded30d] = await Promise.all([
    prisma.dataset.count(),
    prisma.dataset.count({ where: { firstSeenAt: { gte: last7Cutoff } } }),
    prisma.dataset.count({ where: { firstSeenAt: { gte: last30Cutoff } } })
  ]);

  await prisma.dailySnapshot.upsert({
    where: { snapshotDate },
    update: {
      totalDatasets,
      datasetsAdded7d,
      datasetsAdded30d,
      lastIngestRunId: ingestRunId
    },
    create: {
      snapshotDate,
      totalDatasets,
      datasetsAdded7d,
      datasetsAdded30d,
      lastIngestRunId: ingestRunId
    }
  });

  const agencyCounts = await prisma.dataset.groupBy({
    by: ["organizationId"],
    where: {
      organizationId: { not: null }
    },
    _count: {
      _all: true
    }
  });

  const agencySnapshots = agencyCounts
    .filter((row): row is { organizationId: number; _count: { _all: number } } => row.organizationId !== null)
    .map((row) => ({
      snapshotDate,
      agencyId: row.organizationId,
      datasetCount: row._count._all
    }));

  await prisma.dailyAgencySnapshot.deleteMany({
    where: { snapshotDate }
  });

  if (agencySnapshots.length > 0) {
    await prisma.dailyAgencySnapshot.createMany({
      data: agencySnapshots
    });
  }
}

export async function runIngestion(options: RunIngestionOptions = {}): Promise<IngestRunSummary> {
  const pageSize = options.pageSize ?? env.CKAN_PAGE_SIZE;
  const maxPages = options.maxPages ?? env.CKAN_MAX_PAGES;

  const agencyCache = new Map<string, number>();
  const tagCache = new Map<string, number>();

  const ingestRun = await prisma.ingestRun.create({
    data: {
      status: "RUNNING"
    }
  });

  let totalFromSource: number | null = null;
  let processedCount = 0;
  let insertedCount = 0;
  let updatedCount = 0;

  try {
    for (let page = 0; page < maxPages; page += 1) {
      const start = page * pageSize;
      const pageResult = await fetchPackagePage(start, pageSize);

      if (totalFromSource === null) {
        totalFromSource = pageResult.count;
      }

      if (!pageResult.results.length) {
        break;
      }

      for (const pkg of pageResult.results) {
        if (!pkg.id?.trim()) {
          continue;
        }

        processedCount += 1;

        const agencyName = normalizeAgencyName(pkg.organization);
        let agencyId: number | null = null;
        if (agencyName) {
          agencyId = await getOrCreateAgencyId(agencyName, pkg.organization?.id, agencyCache);
        }

        const existingDataset = await prisma.dataset.findUnique({
          where: { ckanId: pkg.id },
          select: { id: true }
        });

        const datasetPayload = {
          title: pkg.title?.trim() || "Untitled dataset",
          notes: pkg.notes?.trim() || null,
          metadataCreated: parseDate(pkg.metadata_created),
          metadataModified: parseDate(pkg.metadata_modified),
          sourceUrl: extractSourceUrl(pkg),
          organizationId: agencyId,
          lastSeenAt: new Date()
        };

        let datasetId: number;
        if (existingDataset) {
          updatedCount += 1;
          const updatedDataset = await prisma.dataset.update({
            where: { id: existingDataset.id },
            data: datasetPayload,
            select: { id: true }
          });
          datasetId = updatedDataset.id;
        } else {
          insertedCount += 1;
          const createdDataset = await prisma.dataset.create({
            data: {
              ckanId: pkg.id,
              ...datasetPayload
            },
            select: { id: true }
          });
          datasetId = createdDataset.id;
        }

        const normalizedTags = Array.from(
          new Set(
            (pkg.tags ?? [])
              .map((tag) => normalizeTagName(tag))
              .filter((tagName): tagName is string => Boolean(tagName))
          )
        );

        await prisma.datasetTag.deleteMany({
          where: { datasetId }
        });

        if (normalizedTags.length > 0) {
          const tagIds = await Promise.all(normalizedTags.map((tagName) => getOrCreateTagId(tagName, tagCache)));

          await prisma.datasetTag.createMany({
            data: tagIds.map((tagId) => ({
              datasetId,
              tagId
            })),
            skipDuplicates: true
          });
        }
      }

      if (pageResult.results.length < pageSize) {
        break;
      }
    }

    await prisma.ingestRun.update({
      where: { id: ingestRun.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        totalFromSource,
        processedCount,
        insertedCount,
        updatedCount
      }
    });

    await recordDailySnapshots(ingestRun.id);

    const finalRun = await prisma.ingestRun.findUniqueOrThrow({
      where: { id: ingestRun.id }
    });

    return mapIngestRun(finalRun);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ingestion error";
    const failedRun = await prisma.ingestRun.update({
      where: { id: ingestRun.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        totalFromSource,
        processedCount,
        insertedCount,
        updatedCount,
        message
      }
    });

    throw new Error(`Ingestion failed on run ${failedRun.id}: ${message}`);
  }
}
