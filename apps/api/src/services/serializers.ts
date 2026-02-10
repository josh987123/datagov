import type { IngestRun, IngestRunStatus } from "@prisma/client";
import type { IngestRunSummary } from "@datagov/shared";
import { toIsoOrNull } from "../utils/date.js";

export function mapIngestRun(run: IngestRun): IngestRunSummary {
  return {
    id: run.id,
    status: run.status as IngestRunStatus,
    startedAt: run.startedAt.toISOString(),
    finishedAt: toIsoOrNull(run.finishedAt),
    totalFromSource: run.totalFromSource,
    processedCount: run.processedCount,
    insertedCount: run.insertedCount,
    updatedCount: run.updatedCount,
    message: run.message ?? null
  };
}
