import { env } from "./config.js";
import { prisma } from "./db.js";
import { runIngestion } from "./services/ingestion.js";

let startupIngestAttempted = false;

export async function maybeRunStartupIngest(): Promise<void> {
  if (startupIngestAttempted) {
    return;
  }
  startupIngestAttempted = true;

  if (!env.AUTO_INGEST_ON_EMPTY) {
    // eslint-disable-next-line no-console
    console.log("Startup ingest disabled (AUTO_INGEST_ON_EMPTY=false).");
    return;
  }

  try {
    const [datasetCount, runningIngest] = await Promise.all([
      prisma.dataset.count(),
      prisma.ingestRun.findFirst({
        where: { status: "RUNNING" },
        orderBy: { startedAt: "desc" }
      })
    ]);

    if (datasetCount > 0) {
      // eslint-disable-next-line no-console
      console.log(`Startup ingest skipped: dataset table already populated (${datasetCount}).`);
      return;
    }

    if (runningIngest) {
      // eslint-disable-next-line no-console
      console.log(`Startup ingest skipped: ingest run #${runningIngest.id} already running.`);
      return;
    }

    // eslint-disable-next-line no-console
    console.log("Startup ingest: database is empty, beginning first ingest job.");
    const run = await runIngestion();
    // eslint-disable-next-line no-console
    console.log(
      `Startup ingest complete: run #${run.id} status=${run.status} processed=${run.processedCount} inserted=${run.insertedCount}.`
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Startup ingest failed:", error);
  }
}
