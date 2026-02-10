import type {
  AgenciesResponse,
  AgencyDetailResponse,
  DatasetsResponse,
  DatasetListItem,
  IngestRunsResponse,
  InsightItem,
  MetricsInsightsResponse,
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
  minQuality?: number;
  staleOnly?: boolean;
  sort?: "recent" | "quality" | "openness" | "freshness";
  page?: number;
  pageSize?: number;
}

export interface AgencyQueryInput {
  search?: string;
  minQuality?: number;
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

type DatasetWithRelations = Prisma.DatasetGetPayload<{
  include: {
    organization: { select: { name: true } };
    tags: { include: { tag: { select: { name: true } } } };
  };
}>;

function toFixedNumber(value: number | null | undefined, digits = 2): number {
  return Number((value ?? 0).toFixed(digits));
}

function mapDatasetRow(row: DatasetWithRelations): DatasetListItem {
  return {
    id: row.id,
    ckanId: row.ckanId,
    title: row.title,
    notes: row.notes,
    resourceCount: row.resourceCount,
    tagCount: row.tagCount,
    qualityScore: row.qualityScore,
    opennessScore: row.opennessScore,
    freshnessScore: row.freshnessScore,
    daysSinceModified: row.daysSinceModified,
    linkStatus: row.linkStatus,
    linkHttpStatus: row.linkHttpStatus,
    hasApiResource: row.hasApiResource,
    hasOpenFormat: row.hasOpenFormat,
    metadataCreated: toIsoOrNull(row.metadataCreated),
    metadataModified: toIsoOrNull(row.metadataModified),
    sourceUrl: row.sourceUrl,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    agency: row.organization?.name ?? null,
    tags: row.tags.map((entry) => entry.tag.name)
  };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((total, value) => total + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export async function getMetricsSummary(): Promise<MetricsSummaryResponse> {
  const now = new Date();
  const [
    totalDatasets,
    datasetsAddedLast7Days,
    datasetsAddedLast30Days,
    staleDatasetCount,
    openFormatCount,
    apiResourceCount,
    brokenLinkCount
  ] = await Promise.all([
    prisma.dataset.count(),
    prisma.dataset.count({ where: { firstSeenAt: { gte: subtractDays(now, 7) } } }),
    prisma.dataset.count({ where: { firstSeenAt: { gte: subtractDays(now, 30) } } }),
    prisma.dataset.count({ where: { OR: [{ daysSinceModified: { gte: 365 } }, { metadataModified: null }] } }),
    prisma.dataset.count({ where: { hasOpenFormat: true } }),
    prisma.dataset.count({ where: { hasApiResource: true } }),
    prisma.dataset.count({ where: { linkStatus: "BROKEN" } })
  ]);

  const [agencyCounts, tagCounts, averages, lastIngestRun] = await Promise.all([
    prisma.dataset.groupBy({
      by: ["organizationId"],
      where: { organizationId: { not: null } },
      _count: { _all: true },
      _avg: {
        qualityScore: true,
        opennessScore: true
      }
    }),
    prisma.datasetTag.groupBy({
      by: ["tagId"],
      _count: { _all: true }
    }),
    prisma.dataset.aggregate({
      _avg: {
        qualityScore: true,
        opennessScore: true
      }
    }),
    prisma.ingestRun.findFirst({
      orderBy: { startedAt: "desc" }
    })
  ]);

  const topAgencyCounts = agencyCounts
    .filter((row) => row.organizationId !== null)
    .map((row) => ({
      organizationId: row.organizationId as number,
      datasetCount: row._count._all,
      avgQualityScore: toFixedNumber(row._avg.qualityScore),
      avgOpennessScore: toFixedNumber(row._avg.opennessScore)
    }))
    .sort((a, b) => b.datasetCount - a.datasetCount)
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
    datasetCount: entry.datasetCount,
    avgQualityScore: entry.avgQualityScore,
    avgOpennessScore: entry.avgOpennessScore
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
    averageQualityScore: toFixedNumber(averages._avg.qualityScore),
    averageOpennessScore: toFixedNumber(averages._avg.opennessScore),
    staleDatasetCount,
    staleDatasetShare: totalDatasets > 0 ? staleDatasetCount / totalDatasets : 0,
    openFormatShare: totalDatasets > 0 ? openFormatCount / totalDatasets : 0,
    apiResourceShare: totalDatasets > 0 ? apiResourceCount / totalDatasets : 0,
    brokenLinkCount,
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
    netDatasetChange: snapshot.netDatasetChange,
    datasetsAdded7d: snapshot.datasetsAdded7d,
    datasetsAdded30d: snapshot.datasetsAdded30d,
    avgQualityScore: snapshot.avgQualityScore,
    avgOpennessScore: snapshot.avgOpennessScore,
    staleDatasetShare: snapshot.staleDatasetShare,
    openFormatShare: snapshot.openFormatShare,
    apiResourceShare: snapshot.apiResourceShare,
    brokenLinkCount: snapshot.brokenLinkCount
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
  const sort = input.sort ?? "recent";

  const andFilters: Prisma.DatasetWhereInput[] = [];

  if (input.search?.trim()) {
    const search = input.search.trim();
    andFilters.push({
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        { ckanId: { contains: search, mode: "insensitive" } }
      ]
    });
  }

  if (input.agency?.trim()) {
    andFilters.push({
      organization: {
        is: {
          name: {
            contains: input.agency.trim(),
            mode: "insensitive"
          }
        }
      }
    });
  }

  if (input.tag?.trim()) {
    andFilters.push({
      tags: {
        some: {
          tag: {
            name: {
              equals: input.tag.trim().toLowerCase(),
              mode: "insensitive"
            }
          }
        }
      }
    });
  }

  if (typeof input.minQuality === "number" && Number.isFinite(input.minQuality)) {
    andFilters.push({
      qualityScore: {
        gte: Math.max(0, Math.min(100, input.minQuality))
      }
    });
  }

  if (input.staleOnly) {
    andFilters.push({
      OR: [{ daysSinceModified: { gte: 365 } }, { metadataModified: null }]
    });
  }

  const where: Prisma.DatasetWhereInput = andFilters.length > 0 ? { AND: andFilters } : {};

  let orderBy: Prisma.DatasetOrderByWithRelationInput[];
  if (sort === "quality") {
    orderBy = [{ qualityScore: "desc" }, { metadataModified: "desc" }];
  } else if (sort === "openness") {
    orderBy = [{ opennessScore: "desc" }, { metadataModified: "desc" }];
  } else if (sort === "freshness") {
    orderBy = [{ freshnessScore: "desc" }, { metadataModified: "desc" }];
  } else {
    orderBy = [{ metadataModified: "desc" }, { updatedAt: "desc" }];
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
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  const data: DatasetListItem[] = rows.map((row) => mapDatasetRow(row));

  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    data
  };
}

export async function getIngestRuns(limitInput = 20): Promise<IngestRunsResponse> {
  const limit = Math.max(1, Math.min(100, limitInput));
  const rows = await prisma.ingestRun.findMany({
    orderBy: { startedAt: "desc" },
    take: limit
  });

  return {
    data: rows.map((row) => mapIngestRun(row))
  };
}

export async function getMetricsInsights(daysInput = 90): Promise<MetricsInsightsResponse> {
  const windowDays = Number.isFinite(daysInput) ? Math.min(Math.max(Math.floor(daysInput), 30), 365) : 90;
  const fromDate = startOfUtcDay(subtractDays(new Date(), windowDays - 1));
  const snapshots = await prisma.dailySnapshot.findMany({
    where: { snapshotDate: { gte: fromDate } },
    orderBy: { snapshotDate: "asc" }
  });

  const insights: InsightItem[] = [];

  if (snapshots.length >= 2) {
    const latest = snapshots[snapshots.length - 1];
    const previous = snapshots[snapshots.length - 2];
    const priorChanges = snapshots.slice(0, -1).map((snapshot) => snapshot.netDatasetChange);
    const baselineAvg = mean(priorChanges);
    const baselineStd = stdDev(priorChanges);

    if (latest.netDatasetChange > baselineAvg + baselineStd) {
      insights.push({
        id: "dataset-growth-acceleration",
        severity: "positive",
        title: "Dataset growth accelerated",
        summary: `Latest net dataset growth was ${latest.netDatasetChange}, above the rolling baseline of ${baselineAvg.toFixed(1)}.`,
        whyItMatters: "Acceleration indicates stronger publication activity and potentially improved catalog currency.",
        recommendation: "Monitor whether growth is broad-based across agencies or concentrated in one publisher.",
        metric: "netDatasetChange",
        delta: latest.netDatasetChange - baselineAvg
      });
    }

    const staleDelta = latest.staleDatasetShare - previous.staleDatasetShare;
    if (latest.staleDatasetShare >= 0.35 || staleDelta > 0.01) {
      insights.push({
        id: "stale-share-pressure",
        severity: "watch",
        title: "Stale dataset pressure is elevated",
        summary: `Stale share is ${(latest.staleDatasetShare * 100).toFixed(1)}% (${(staleDelta * 100).toFixed(1)} pp day-over-day).`,
        whyItMatters: "Higher staleness can reduce trust, relevance, and downstream analytics quality.",
        recommendation: "Prioritize refresh cycles for high-demand agencies and old mission-critical datasets.",
        metric: "staleDatasetShare",
        delta: staleDelta
      });
    }

    const qualityDelta = latest.avgQualityScore - previous.avgQualityScore;
    if (Math.abs(qualityDelta) >= 0.5) {
      insights.push({
        id: "quality-score-shift",
        severity: qualityDelta > 0 ? "positive" : "watch",
        title: qualityDelta > 0 ? "Catalog quality improved" : "Catalog quality dipped",
        summary: `Average quality score moved by ${qualityDelta.toFixed(2)} points to ${latest.avgQualityScore.toFixed(2)}.`,
        whyItMatters: "Quality shifts reflect changes in metadata completeness, freshness, and usability.",
        recommendation: "Use quality score by agency to target metadata clean-up and freshness campaigns.",
        metric: "avgQualityScore",
        delta: qualityDelta
      });
    }

    const opennessDelta = latest.avgOpennessScore - previous.avgOpennessScore;
    if (Math.abs(opennessDelta) >= 0.5) {
      insights.push({
        id: "openness-score-shift",
        severity: opennessDelta > 0 ? "positive" : "watch",
        title: opennessDelta > 0 ? "Openness signals strengthened" : "Openness signals softened",
        summary: `Average openness score moved by ${opennessDelta.toFixed(2)} points to ${latest.avgOpennessScore.toFixed(2)}.`,
        whyItMatters: "Open, machine-readable data drives reuse, automation, and public impact.",
        recommendation: "Encourage agencies to publish API-enabled or open-format resources with clear licensing.",
        metric: "avgOpennessScore",
        delta: opennessDelta
      });
    }

    if (latest.brokenLinkCount > 0) {
      insights.push({
        id: "broken-link-risk",
        severity: "alert",
        title: "Broken resource links detected",
        summary: `${latest.brokenLinkCount} datasets currently show broken link checks.`,
        whyItMatters: "Broken links break user workflows and reduce confidence in published data products.",
        recommendation: "Run link remediation with agency data owners and prioritize high-traffic datasets first.",
        metric: "brokenLinkCount",
        delta: latest.brokenLinkCount
      });
    }

    const latestAgencyRows = await prisma.dailyAgencySnapshot.findMany({
      where: { snapshotDate: latest.snapshotDate },
      include: {
        agency: {
          select: { id: true, name: true }
        }
      }
    });

    const baselineAgencySnapshot = await prisma.dailySnapshot.findFirst({
      where: { snapshotDate: { lte: subtractDays(latest.snapshotDate, 30) } },
      orderBy: { snapshotDate: "desc" },
      select: { snapshotDate: true }
    });

    if (baselineAgencySnapshot) {
      const baselineAgencyRows = await prisma.dailyAgencySnapshot.findMany({
        where: { snapshotDate: baselineAgencySnapshot.snapshotDate }
      });
      const baselineMap = new Map<number, number>();
      for (const row of baselineAgencyRows) {
        baselineMap.set(row.agencyId, row.datasetCount);
      }

      const momentumCandidate = latestAgencyRows
        .map((row) => ({
          agencyId: row.agencyId,
          agencyName: row.agency.name,
          delta: row.datasetCount - (baselineMap.get(row.agencyId) ?? 0)
        }))
        .sort((a, b) => b.delta - a.delta)[0];

      if (momentumCandidate && momentumCandidate.delta > 0) {
        insights.push({
          id: "agency-momentum-leader",
          severity: "info",
          title: "Agency momentum leader",
          summary: `${momentumCandidate.agencyName} added ${momentumCandidate.delta.toLocaleString()} datasets over 30 days.`,
          whyItMatters: "Agency-level momentum highlights where publication capacity and cadence are improving.",
          recommendation: "Replicate publication workflows from high-momentum agencies where feasible.",
          metric: "agency30dDelta",
          delta: momentumCandidate.delta
        });
      }
    }
  }

  const severityRank: Record<InsightItem["severity"], number> = {
    alert: 4,
    watch: 3,
    positive: 2,
    info: 1
  };

  insights.sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || Math.abs(b.delta) - Math.abs(a.delta));

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    insights: insights.slice(0, 12)
  };
}

export async function getAgencies(input: AgencyQueryInput): Promise<AgenciesResponse> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE));
  const minQuality = typeof input.minQuality === "number" ? Math.max(0, Math.min(100, input.minQuality)) : null;

  const agencies = await prisma.agency.findMany({
    where: input.search?.trim()
      ? {
          name: {
            contains: input.search.trim(),
            mode: "insensitive"
          }
        }
      : undefined,
    select: {
      id: true,
      name: true
    }
  });

  const agencyIds = agencies.map((agency) => agency.id);
  if (agencyIds.length === 0) {
    return {
      page,
      pageSize,
      total: 0,
      totalPages: 1,
      data: []
    };
  }

  const [baseStats, staleStats, openStats, latestDateRow] = await Promise.all([
    prisma.dataset.groupBy({
      by: ["organizationId"],
      where: {
        organizationId: { in: agencyIds }
      },
      _count: { _all: true },
      _avg: {
        qualityScore: true,
        opennessScore: true
      }
    }),
    prisma.dataset.groupBy({
      by: ["organizationId"],
      where: {
        organizationId: { in: agencyIds },
        OR: [{ daysSinceModified: { gte: 365 } }, { metadataModified: null }]
      },
      _count: { _all: true }
    }),
    prisma.dataset.groupBy({
      by: ["organizationId"],
      where: {
        organizationId: { in: agencyIds },
        hasOpenFormat: true
      },
      _count: { _all: true }
    }),
    prisma.dailySnapshot.findFirst({
      orderBy: { snapshotDate: "desc" },
      select: { snapshotDate: true }
    })
  ]);

  const staleMap = new Map<number, number>();
  for (const row of staleStats) {
    if (row.organizationId !== null) {
      staleMap.set(row.organizationId, row._count._all);
    }
  }

  const openMap = new Map<number, number>();
  for (const row of openStats) {
    if (row.organizationId !== null) {
      openMap.set(row.organizationId, row._count._all);
    }
  }

  let growth30Map = new Map<number, number>();
  if (latestDateRow) {
    const baselineRow = await prisma.dailySnapshot.findFirst({
      where: { snapshotDate: { lte: subtractDays(latestDateRow.snapshotDate, 30) } },
      orderBy: { snapshotDate: "desc" },
      select: { snapshotDate: true }
    });

    const latestAgency = await prisma.dailyAgencySnapshot.findMany({
      where: {
        snapshotDate: latestDateRow.snapshotDate,
        agencyId: { in: agencyIds }
      },
      select: {
        agencyId: true,
        datasetCount: true
      }
    });

    const latestMap = new Map<number, number>();
    for (const row of latestAgency) {
      latestMap.set(row.agencyId, row.datasetCount);
    }

    const baselineMap = new Map<number, number>();
    if (baselineRow) {
      const baselineAgency = await prisma.dailyAgencySnapshot.findMany({
        where: {
          snapshotDate: baselineRow.snapshotDate,
          agencyId: { in: agencyIds }
        },
        select: {
          agencyId: true,
          datasetCount: true
        }
      });
      for (const row of baselineAgency) {
        baselineMap.set(row.agencyId, row.datasetCount);
      }
    }

    growth30Map = new Map<number, number>();
    for (const agencyId of agencyIds) {
      const latestCount = latestMap.get(agencyId) ?? 0;
      const baselineCount = baselineMap.get(agencyId) ?? 0;
      growth30Map.set(agencyId, latestCount - baselineCount);
    }
  }

  const agencyNameMap = new Map<number, string>();
  for (const agency of agencies) {
    agencyNameMap.set(agency.id, agency.name);
  }

  const ranked = baseStats
    .filter((row): row is { organizationId: number; _count: { _all: number }; _avg: { qualityScore: number | null; opennessScore: number | null } } => row.organizationId !== null)
    .map((row) => {
      const total = row._count._all;
      const stale = staleMap.get(row.organizationId) ?? 0;
      const open = openMap.get(row.organizationId) ?? 0;
      const avgQualityScore = toFixedNumber(row._avg.qualityScore);
      return {
        id: row.organizationId,
        name: agencyNameMap.get(row.organizationId) ?? "Unknown agency",
        datasetCount: total,
        avgQualityScore,
        avgOpennessScore: toFixedNumber(row._avg.opennessScore),
        staleShare: total > 0 ? stale / total : 0,
        openFormatShare: total > 0 ? open / total : 0,
        growth30d: growth30Map.get(row.organizationId) ?? 0
      };
    })
    .filter((row) => (minQuality !== null ? row.avgQualityScore >= minQuality : true))
    .sort((a, b) => b.datasetCount - a.datasetCount || b.avgQualityScore - a.avgQualityScore)
    .map((row, index) => ({
      ...row,
      rank: index + 1
    }));

  const total = ranked.length;
  const data = ranked.slice((page - 1) * pageSize, page * pageSize);

  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    data
  };
}

export async function getAgencyDetail(agencyId: number, daysInput = 180): Promise<AgencyDetailResponse | null> {
  const days = Number.isFinite(daysInput) ? Math.min(Math.max(Math.floor(daysInput), 30), 365) : 180;
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { id: true, name: true }
  });

  if (!agency) {
    return null;
  }

  const fromDate = startOfUtcDay(subtractDays(new Date(), days - 1));

  const [aggregate, staleCount, openCount, apiCount, brokenCount, trendRows, tagGroups, latestSnapshots, recentDatasets] = await Promise.all([
    prisma.dataset.aggregate({
      where: { organizationId: agencyId },
      _count: { _all: true },
      _avg: {
        qualityScore: true,
        opennessScore: true
      }
    }),
    prisma.dataset.count({
      where: { organizationId: agencyId, OR: [{ daysSinceModified: { gte: 365 } }, { metadataModified: null }] }
    }),
    prisma.dataset.count({
      where: { organizationId: agencyId, hasOpenFormat: true }
    }),
    prisma.dataset.count({
      where: { organizationId: agencyId, hasApiResource: true }
    }),
    prisma.dataset.count({
      where: { organizationId: agencyId, linkStatus: "BROKEN" }
    }),
    prisma.dailyAgencySnapshot.findMany({
      where: {
        agencyId,
        snapshotDate: { gte: fromDate }
      },
      orderBy: {
        snapshotDate: "asc"
      }
    }),
    prisma.datasetTag.groupBy({
      by: ["tagId"],
      where: {
        dataset: {
          organizationId: agencyId
        }
      },
      _count: { _all: true }
    }),
    prisma.dailyAgencySnapshot.findMany({
      where: { agencyId },
      orderBy: { snapshotDate: "desc" },
      take: 1
    }),
    prisma.dataset.findMany({
      where: { organizationId: agencyId },
      include: {
        organization: { select: { name: true } },
        tags: {
          include: {
            tag: { select: { name: true } }
          }
        }
      },
      orderBy: [{ metadataModified: "desc" }, { updatedAt: "desc" }],
      take: 12
    })
  ]);

  const total = aggregate._count._all;
  const trend = trendRows.map((row) => ({
    date: row.snapshotDate.toISOString().slice(0, 10),
    datasetCount: row.datasetCount
  }));

  const latestSnapshot = latestSnapshots[0] ?? null;

  const baseline30 = latestSnapshot
    ? await prisma.dailyAgencySnapshot.findFirst({
        where: { agencyId, snapshotDate: { lte: subtractDays(latestSnapshot.snapshotDate, 30) } },
        orderBy: { snapshotDate: "desc" }
      })
    : null;
  const baseline90 = latestSnapshot
    ? await prisma.dailyAgencySnapshot.findFirst({
        where: { agencyId, snapshotDate: { lte: subtractDays(latestSnapshot.snapshotDate, 90) } },
        orderBy: { snapshotDate: "desc" }
      })
    : null;

  const growth30d = latestSnapshot ? latestSnapshot.datasetCount - (baseline30?.datasetCount ?? 0) : 0;
  const growth90d = latestSnapshot ? latestSnapshot.datasetCount - (baseline90?.datasetCount ?? 0) : 0;

  const topTagRows = tagGroups.sort((a, b) => b._count._all - a._count._all).slice(0, 10);
  const topTagIds = topTagRows.map((row) => row.tagId);
  const tags = topTagIds.length
    ? await prisma.tag.findMany({
        where: { id: { in: topTagIds } },
        select: { id: true, name: true }
      })
    : [];
  const tagNameMap = new Map(tags.map((tag) => [tag.id, tag.name]));

  const topTags = topTagRows.map((row) => ({
    name: tagNameMap.get(row.tagId) ?? "unknown",
    count: row._count._all
  }));

  const [freshRecent, freshSeasonal, freshAging, freshStale, freshUnknown] = await Promise.all([
    prisma.dataset.count({ where: { organizationId: agencyId, daysSinceModified: { lt: 30 } } }),
    prisma.dataset.count({ where: { organizationId: agencyId, daysSinceModified: { gte: 30, lt: 180 } } }),
    prisma.dataset.count({ where: { organizationId: agencyId, daysSinceModified: { gte: 180, lt: 365 } } }),
    prisma.dataset.count({ where: { organizationId: agencyId, daysSinceModified: { gte: 365 } } }),
    prisma.dataset.count({ where: { organizationId: agencyId, metadataModified: null } })
  ]);

  const freshnessBuckets = [
    { label: "< 30d", count: freshRecent },
    { label: "30-180d", count: freshSeasonal },
    { label: "180-365d", count: freshAging },
    { label: "> 365d", count: freshStale },
    { label: "Unknown", count: freshUnknown }
  ];

  return {
    summary: {
      id: agency.id,
      name: agency.name,
      datasetCount: total,
      avgQualityScore: toFixedNumber(aggregate._avg.qualityScore),
      avgOpennessScore: toFixedNumber(aggregate._avg.opennessScore),
      staleShare: total > 0 ? staleCount / total : 0,
      openFormatShare: total > 0 ? openCount / total : 0,
      apiResourceShare: total > 0 ? apiCount / total : 0,
      brokenLinkShare: total > 0 ? brokenCount / total : 0,
      growth30d,
      growth90d
    },
    trend,
    topTags,
    freshnessBuckets,
    recentDatasets: recentDatasets.map((row) => mapDatasetRow(row))
  };
}
