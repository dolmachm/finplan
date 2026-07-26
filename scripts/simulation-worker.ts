/**
 * Background worker for Monte Carlo jobs.
 * Run: npm run worker
 */
import { prisma } from "../src/shared/db";
import {
  processSimulationJob,
  processSimulationJobForce,
} from "../src/modules/simulation/simulation.service";

const POLL_MS = 3000;
const STALE_MS = 3 * 60 * 1000;

async function poll() {
  const pending = await prisma.simulationJob.findFirst({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });

  if (pending) {
    console.log(`Processing PENDING ${pending.id}`);
    await processSimulationJob(pending.id);
    console.log(`Finished ${pending.id}`);
    return;
  }

  // Подхватить «зависшие» RUNNING (процесс оборвался)
  const running = await prisma.simulationJob.findFirst({
    where: { status: "RUNNING" },
    orderBy: { createdAt: "asc" },
  });
  if (
    running?.startedAt &&
    Date.now() - new Date(running.startedAt).getTime() > STALE_MS &&
    (running.progressPct ?? 0) < 100
  ) {
    console.log(`Reaping stale RUNNING ${running.id} @ ${running.progressPct}%`);
    await prisma.simulationJob.update({
      where: { id: running.id },
      data: { status: "PENDING", progressPct: 0 },
    });
    await processSimulationJobForce(running.id);
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
