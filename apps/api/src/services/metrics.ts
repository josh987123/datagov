import type {
  DatasetsResponse,
  DatasetListItem,
  MetricsSummaryResponse,
  MetricsTrendsResponse,
  TopAgency,
  TopTag
} from "@datagov/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { mapIngestRun } from "./serializers.js";
import { startOfUtcDay, subtractDays, toIsoOrNull } from "../utils/date.js";

export interface DatasetQueryInput {
  search?: string;
  agency?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function getMetricsSummary(): Promise<MetricsSummaryResponse> {
  const now = new Date();
  const [totalDatasets, datasetsAddedLast7Days, datasetsAddedLast30Days] = await Promise.all([
    prisma.dataset.count(),
    prisma.dataset.count({ where: { firstSeenAt: { gte: subtractDays(now, 7) } } }),
    prisma.dataset.count({ where: { firstSeenAt: { gte: subtractDays(now, 30) } } })
  ]);

  const [agencyCounts, tagCounts, lastIngestRun] = await Promise.all([
    prisma.dataset.groupBy({
      by: ["organizationId"],
      where: { organizationId: { not: null } },
      _count: { _all: true }
    }),
    prisma.datasetTag.groupBy({
      by: ["tagId"],
      _count: { _all: true }
    }),
    prisma.ingestRun.findFirst({
      orderBy: { startedAt: "desc" }
    })
  ]);

  const topAgencyCounts = agencyCounts
    .filter((row): row is { organizationId: number; _count: { _all: number } } => row.organizationId !== null)
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 10);

  const agencyMap = new Map<number, string>();
  if (topAgencyCounts.length > 0) {
    const agencies = await prisma.agency.findMany({
      where: {
        id: { in: topAgencyCounts.map((entry) => entry.organizationId) }
      },
      select: {
        id: true,
        name: true
      }
    });
    for (const agency of agencies) {
      agencyMap.set(agency.id, agency.name);
    }
  }

  const topAgencies: TopAgency[] = topAgencyCounts.map((entry) => ({
    id: entry.organizationId,
    name: agencyMap.get(entry.organizationId) ?? "Unknown agency",
    datasetCount: entry._count._all
  }));

  const topTagCounts = tagCounts.sort((a, b) => b._count._all - a._count._all).slice(0, 12);

  const tagMap = new Map<number, string>();
  if (topTagCounts.length > 0) {
    const tags = await prisma.tag.findMany({
      where: {
        id: { in: topTagCounts.map((entry) => entry.tagId) }
      },
      select: {
        id: true,
        name: true
      }
    });
    for (const tag of tags) {
      tagMap.set(tag.id, tag.name);
    }
  }

  const mostCommonTags: TopTag[] = topTagCounts.map((entry) => ({
    id: entry.tagId,
    name: tagMap.get(entry.tagId) ?? "unknown",
    datasetCount: entry._count._all
  }));

  return {
    totalDatasets,
    datasetsAddedLast7Days,
    datasetsAddedLast30Days,
    topAgencies,
    mostCommonTags,
    lastIngest: lastIngestRun ? mapIngestRun(lastIngestRun) : null
  };
}

export async function getMetricsTrends(daysInput: number): Promise<MetricsTrendsResponse> {
  const days = Number.isFinite(daysInput) ? Math.min(Math.max(Math.floor(daysInput), 7), 365) : 30;
  const fromDate = startOfUtcDay(subtractDays(new Date(), days - 1));

  const [dailySnapshots, agencySnapshots] = await Promise.all([
    prisma.dailySnapshot.findMany({
      where: {
        snapshotDate: { gte: fromDate }
      },
      orderBy: {
        snapshotDate: "asc"
      }
    }),
    prisma.dailyAgencySnapshot.findMany({
      where: {
        snapshotDate: { gte: fromDate }
      },
      include: {
        agency: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        snapshotDate: "asc"
      }
    })
  ]);

  const totals = dailySnapshots.map((snapshot) => ({
    date: snapshot.snapshotDate.toISOString().slice(0, 10),
    totalDatasets: snapshot.totalDatasets,
    datasetsAdded7d: snapshot.datasetsAdded7d,
    datasetsAdded30d: snapshot.datasetsAdded30d
  }));

  const latestDate = dailySnapshots.length > 0 ? dailySnapshots[dailySnapshots.length - 1].snapshotDate.getTime() : null;

  const latestAgencyCounts = new Map<number, number>();
  for (const snapshot of agencySnapshots) {
    if (latestDate !== null && snapshot.snapshotDate.getTime() === latestDate) {
      latestAgencyCounts.set(snapshot.agencyId, snapshot.datasetCount);
    }
  }

  const topAgencyIds = Array.from(latestAgencyCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([agencyId]) => agencyId);

  const seriesMap = new Map<number, { agencyId: number; agencyName: string; points: Array<{ date: string; datasetCount: number }> }>();
  for (const agencyId of topAgencyIds) {
    const agency = agencySnapshots.find((entry) => entry.agencyId === agencyId)?.agency;
    if (agency) {
      seriesMap.set(agencyId, {
        agencyId,
        agencyName: agency.name,
        points: []
      });
    }
  }

  for (const snapshot of agencySnapshots) {
    const target = seriesMap.get(snapshot.agencyId);
    if (target) {
      target.points.push({
        date: snapshot.snapshotDate.toISOString().slice(0, 10),
        datasetCount: snapshot.datasetCount
      });
    }
  }

  return {
    days,
    totals,
    topAgenciesOverTime: Array.from(seriesMap.values())
  };
}

export async function getDatasets(input: DatasetQueryInput): Promise<DatasetsResponse> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE));

  const where: Prisma.DatasetWhereInput = {};

  if (input.search?.trim()) {
    const search = input.search.trim();
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { notes: { contains: search, mode: "insensitive" } },
      { ckanId: { contains: search, mode: "insensitive" } }
    ];
  }

  if (input.agency?.trim()) {
    where.organization = {
      is: {
        name: {
          contains: input.agency.trim(),
          mode: "insensitive"
        }
      }
    };
  }

  if (input.tag?.trim()) {
    where.tags = {
      some: {
        tag: {
          name: {
            equals: input.tag.trim().toLowerCase(),
            mode: "insensitive"
          }
        }
      }
    };
  }

  const [total, rows] = await Promise.all([
    prisma.dataset.count({ where }),
    prisma.dataset.findMany({
      where,
      include: {
        organization: {
          select: {
            name: true
          }
        },
        tags: {
          include: {
            tag: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: [{ metadataModified: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  const data: DatasetListItem[] = rows.map((row) => ({
    id: row.id,
    ckanId: row.ckanId,
    title: row.title,
    notes: row.notes,
    metadataCreated: toIsoOrNull(row.metadataCreated),
    metadataModified: toIsoOrNull(row.metadataModified),
    sourceUrl: row.sourceUrl,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    agency: row.organization?.name ?? null,
    tags: row.tags.map((entry) => entry.tag.name)
  }));

  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    data
  };
}
