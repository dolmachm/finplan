import { prisma, type InputJsonValue } from "@/shared/db";
import { loadPlanInputForUser } from "@/modules/plan/plan-data.service";
import { runDeterministicPlan } from "@/modules/plan/cashflow.engine";
import {
  runMonteCarlo,
  runSensitivity,
} from "@/modules/simulation/monte-carlo.engine";
import { resolveScenarioModifiers } from "@/modules/scenarios/scenario-modifiers";

const DAILY_QUOTA = Number(process.env.SIMULATION_DAILY_QUOTA ?? 10);
export const DEFAULT_MC_RUNS = 1200;
const SENSITIVITY_RUNS = 40;

export async function checkSimulationQuota(userId: string): Promise<boolean> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const count = await prisma.simulationJob.count({
    where: { userId, createdAt: { gte: since } },
  });
  return count < DAILY_QUOTA;
}

export async function enqueueSimulation(
  userId: string,
  opts: { scenarioId?: string; numRuns?: number },
) {
  const allowed = await checkSimulationQuota(userId);
  if (!allowed) throw new Error("QUOTA_EXCEEDED");

  let scenarioParams: Record<string, unknown> = {};
  if (opts.scenarioId) {
    const scenario = await prisma.scenario.findFirst({
      where: { id: opts.scenarioId, userId },
    });
    if (!scenario) throw new Error("SCENARIO_NOT_FOUND");
    scenarioParams = (scenario.params as Record<string, unknown>) ?? {};
  }

  return prisma.simulationJob.create({
    data: {
      userId,
      scenarioId: opts.scenarioId,
      numRuns: opts.numRuns ?? DEFAULT_MC_RUNS,
      params: scenarioParams as unknown as InputJsonValue,
      status: "PENDING",
    },
  });
}

export async function processSimulationJob(jobId: string) {
  const job = await prisma.simulationJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "PENDING") return;
  await runSimulationJobBody(jobId);
}

/** Для API: можно вызывать, если статус уже RUNNING */
export async function processSimulationJobForce(jobId: string) {
  await runSimulationJobBody(jobId);
}

async function runSimulationJobBody(jobId: string) {
  const job = await prisma.simulationJob.findUnique({
    where: { id: jobId },
    include: { scenario: true },
  });
  if (!job) return;
  if (job.status === "COMPLETED" || job.status === "FAILED") return;

  await prisma.simulationJob.update({
    where: { id: jobId },
    data: {
      status: "RUNNING",
      startedAt: job.startedAt ?? new Date(),
      progressPct: Math.max(1, job.progressPct || 0),
    },
  });

  try {
    const planInput = await loadPlanInputForUser(job.userId);
    const modifiers = resolveScenarioModifiers(
      (job.params as Record<string, unknown>) ??
        (job.scenario?.params as Record<string, unknown>) ??
        {},
      job.scenario?.rules,
      planInput,
    );

    const deterministic = runDeterministicPlan(planInput, modifiers);
    const numRuns = Math.min(Math.max(job.numRuns, 500), 5000);

    const mc = await runMonteCarlo(
      planInput,
      {
        numRuns,
        horizonMonths: planInput.horizonMonths,
        crisisShockPct: modifiers.assetShockPct,
        modifiers,
      },
      async (pct) => {
        await prisma.simulationJob.update({
          where: { id: jobId },
          data: { progressPct: Math.min(95, pct) },
        });
      },
    );

    await prisma.simulationJob.update({
      where: { id: jobId },
      data: { progressPct: 96 },
    });

    const sensitivity = await runSensitivity(
      planInput,
      SENSITIVITY_RUNS,
      modifiers,
    );

    await prisma.planSnapshot.create({
      data: {
        userId: job.userId,
        scenarioId: job.scenarioId,
        deterministic: deterministic as unknown as InputJsonValue,
        cashflowMonthly: deterministic.monthly.map(
          (m) => m.cashflow,
        ) as unknown as InputJsonValue,
        netWorthMonthly: deterministic.monthly.map(
          (m) => m.netWorth,
        ) as unknown as InputJsonValue,
      },
    });

    await prisma.simulationResult.create({
      data: {
        jobId,
        goalProbabilities: mc.goalResults as unknown as InputJsonValue,
        wealthPercentiles: mc.wealthAtHorizon as unknown as InputJsonValue,
        samplePaths: mc.samplePaths as unknown as InputJsonValue,
        sensitivity: sensitivity as unknown as InputJsonValue,
      },
    });

    await prisma.simulationJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        progressPct: 100,
        completedAt: new Date(),
      },
    });
  } catch (e) {
    await prisma.simulationJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errorMessage: e instanceof Error ? e.message : "Unknown error",
        completedAt: new Date(),
      },
    });
  }
}

export async function seedPredefinedScenarios(userId: string) {
  const existing = await prisma.scenario.count({ where: { userId } });
  if (existing > 0) return;

  const templates = [
    { key: "base", name: "Базовый", active: true },
    { key: "conservative", name: "Консервативный", active: false },
    { key: "crisis", name: "Кризис", active: false },
  ];

  for (const t of templates) {
    await prisma.scenario.create({
      data: {
        userId,
        name: t.name,
        kind: "PREDEFINED",
        templateKey: t.key,
        isActive: t.active,
        params: { templateKey: t.key },
      },
    });
  }
}
