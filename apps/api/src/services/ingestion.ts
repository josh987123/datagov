import type { IngestRunSummary } from "@datagov/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { env } from "../config.js";
import {
  evaluateResourceSignals,
  extractSourceUrl,
  fetchPackagePage,
  normalizeAgencyName,
  normalizeTagName,
  parseDate
} from "./ckan.js";
import { mapIngestRun } from "./serializers.js";
import { startOfUtcDay, subtractDays } from "../utils/date.js";
import {
  computeDaysSinceModified,
  computeFreshnessScore,
  computeOpennessScore,
  computeQualityScore
} from "./scoring.js";
import { checkLinkHealth } from "./link-health.js";

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

  const [totalDatasets, datasetsAdded7d, datasetsAdded30d, staleDatasetCount, openFormatCount, apiResourceCount, brokenLinkCount] =
    await Promise.all([
    prisma.dataset.count(),
    prisma.dataset.count({ where: { firstSeenAt: { gte: last7Cutoff } } }),
    prisma.dataset.count({ where: { firstSeenAt: { gte: last30Cutoff } } }),
    prisma.dataset.count({ where: { OR: [{ daysSinceModified: { gte: 365 } }, { metadataModified: null }] } }),
    prisma.dataset.count({ where: { hasOpenFormat: true } }),
    prisma.dataset.count({ where: { hasApiResource: true } }),
    prisma.dataset.count({ where: { linkStatus: "BROKEN" } })
  ]);

  const averages = await prisma.dataset.aggregate({
    _avg: {
      qualityScore: true,
      opennessScore: true
    }
  });

  const previousSnapshot = await prisma.dailySnapshot.findFirst({
    where: {
      snapshotDate: { lt: snapshotDate }
    },
    orderBy: {
      snapshotDate: "desc"
    },
    select: {
      totalDatasets: true
    }
  });

  const avgQualityScore = Number((averages._avg.qualityScore ?? 0).toFixed(2));
  const avgOpennessScore = Number((averages._avg.opennessScore ?? 0).toFixed(2));
  const staleDatasetShare = totalDatasets > 0 ? Number((staleDatasetCount / totalDatasets).toFixed(4)) : 0;
  const openFormatShare = totalDatasets > 0 ? Number((openFormatCount / totalDatasets).toFixed(4)) : 0;
  const apiResourceShare = totalDatasets > 0 ? Number((apiResourceCount / totalDatasets).toFixed(4)) : 0;
  const netDatasetChange = previousSnapshot ? totalDatasets - previousSnapshot.totalDatasets : 0;

  await prisma.dailySnapshot.upsert({
    where: { snapshotDate },
    update: {
      totalDatasets,
      netDatasetChange,
      datasetsAdded7d,
      datasetsAdded30d,
      avgQualityScore,
      avgOpennessScore,
      staleDatasetCount,
      staleDatasetShare,
      openFormatShare,
      apiResourceShare,
      brokenLinkCount,
      lastIngestRunId: ingestRunId
    },
    create: {
      snapshotDate,
      totalDatasets,
      netDatasetChange,
      datasetsAdded7d,
      datasetsAdded30d,
      avgQualityScore,
      avgOpennessScore,
      staleDatasetCount,
      staleDatasetShare,
      openFormatShare,
      apiResourceShare,
      brokenLinkCount,
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
  let linkChecksPerformed = 0;
  const linkCheckMax = env.LINK_CHECK_MAX_PER_RUN;

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
        const now = new Date();

        const agencyName = normalizeAgencyName(pkg.organization);
        let agencyId: number | null = null;
        if (agencyName) {
          agencyId = await getOrCreateAgencyId(agencyName, pkg.organization?.id, agencyCache);
        }

        const existingDataset = await prisma.dataset.findUnique({
          where: { ckanId: pkg.id },
          select: {
            id: true,
            sourceUrl: true,
            linkCheckedAt: true
          }
        });

        const normalizedTags = Array.from(
          new Set(
            (pkg.tags ?? [])
              .map((tag) => normalizeTagName(tag))
              .filter((tagName): tagName is string => Boolean(tagName))
          )
        );

        const sourceUrl = extractSourceUrl(pkg);
        const metadataModified = parseDate(pkg.metadata_modified);
        const metadataCreated = parseDate(pkg.metadata_created);
        const resourceSignals = evaluateResourceSignals(pkg.resources);
        const hasDescription = Boolean(pkg.notes?.trim());
        const hasLicense = Boolean(pkg.license_id?.trim() || pkg.license_title?.trim());
        const daysSinceModified = computeDaysSinceModified(metadataModified);
        const freshnessScore = computeFreshnessScore(daysSinceModified);
        const qualityScore = computeQualityScore({
          hasDescription,
          tagCount: normalizedTags.length,
          resourceCount: resourceSignals.resourceCount,
          hasLicense,
          freshnessScore
        });
        const opennessScore = computeOpennessScore({
          hasOpenFormat: resourceSignals.hasOpenFormat,
          hasApiResource: resourceSignals.hasApiResource,
          hasLicense,
          resourceCount: resourceSignals.resourceCount
        });

        const datasetPayload: Prisma.DatasetUncheckedCreateInput = {
          ckanId: pkg.id,
          title: pkg.title?.trim() || "Untitled dataset",
          notes: pkg.notes?.trim() || null,
          metadataCreated,
          metadataModified,
          sourceUrl,
          organizationId: agencyId,
          lastSeenAt: now,
          resourceCount: resourceSignals.resourceCount,
          tagCount: normalizedTags.length,
          hasOpenFormat: resourceSignals.hasOpenFormat,
          hasApiResource: resourceSignals.hasApiResource,
          hasDescription,
          hasLicense,
          freshnessScore,
          qualityScore,
          opennessScore,
          daysSinceModified
        };

        const shouldEvaluateLink =
          env.LINK_CHECK_ENABLED &&
          Boolean(sourceUrl) &&
          linkChecksPerformed < linkCheckMax &&
          (!existingDataset?.linkCheckedAt ||
            Date.now() - existingDataset.linkCheckedAt.getTime() > 14 * 24 * 60 * 60 * 1000 ||
            existingDataset.sourceUrl !== sourceUrl);

        if (shouldEvaluateLink && sourceUrl) {
          const health = await checkLinkHealth(sourceUrl, env.LINK_CHECK_TIMEOUT_MS);
          datasetPayload.linkStatus = health.status;
          datasetPayload.linkHttpStatus = health.httpStatus;
          datasetPayload.linkCheckedAt = health.checkedAt;
          linkChecksPerformed += 1;
        }

        const updatePayload: Prisma.DatasetUncheckedUpdateInput = { ...datasetPayload };
        delete updatePayload.ckanId;

        let datasetId: number;
        if (existingDataset) {
          updatedCount += 1;
          const updatedDataset = await prisma.dataset.update({
            where: { id: existingDataset.id },
            data: updatePayload,
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
        updatedCount,
        message:
          linkChecksPerformed > 0
            ? `Completed with ${linkChecksPerformed} link health checks.`
            : "Completed without link health checks."
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
