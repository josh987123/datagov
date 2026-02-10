import { prisma } from "../db.js";
import { runIngestion } from "../services/ingestion.js";

async function main(): Promise<void> {
  const run = await runIngestion();
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, run }, null, 2));
}

main()
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
