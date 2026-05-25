/**
 * Background worker for Monte Carlo jobs.
 * Run: npm run worker
 */
import { prisma } from "../src/shared/db";
import { processSimulationJob } from "../src/modules/simulation/simulation.service";

const POLL_MS = 3000;

async function poll() {
  const job = await prisma.simulationJob.findFirst({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });

  if (job) {
    console.log(`Processing simulation ${job.id} for user ${job.userId}`);
    await processSimulationJob(job.id);
    console.log(`Finished ${job.id}`);
  }
}

async function main() {
  console.log("FinPlan simulation worker started");
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await poll();
    } catch (e) {
      console.error("Worker error:", e);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main();
