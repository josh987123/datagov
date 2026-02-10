import { prisma } from "../src/db.js";
import { runIngestion } from "../src/services/ingestion.js";

async function main(): Promise<void> {
  const run = await runIngestion();
  // eslint-disable-next-line no-console
  console.log(`Seed ingest completed. Run #${run.id} (${run.status})`);
}

main()
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
