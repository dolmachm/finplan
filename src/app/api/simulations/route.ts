import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/shared/api-validation";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import {
  DEFAULT_MC_RUNS,
  enqueueSimulation,
  processSimulationJobForce,
} from "@/modules/simulation/simulation.service";

/** Длинный расчёт на хостинге с лимитом времени */
export const maxDuration = 120;

export async function GET() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const jobs = await prisma.simulationJob.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json(jobs);
}

const postSchema = z.object({
  scenarioId: z.string().optional(),
  numRuns: z.number().int().min(500).max(5000).optional(),
});

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const parsed = parseJsonBody(postSchema, await req.json().catch(() => ({})));
  if (!parsed.ok) return parsed.response;

  try {
    const body = parsed.data;
    const active = await prisma.scenario.findFirst({
      where: { userId, isActive: true },
    });
    const job = await enqueueSimulation(userId, {
      scenarioId: body.scenarioId ?? active?.id,
      numRuns: body.numRuns ?? DEFAULT_MC_RUNS,
    });

    await prisma.simulationJob.update({
      where: { id: job.id },
      data: { status: "RUNNING", startedAt: new Date(), progressPct: 1 },
    });

    // Полный await — иначе job мог навсегда остаться PENDING без воркера.
    await processSimulationJobForce(job.id);

    const done = await prisma.simulationJob.findUnique({
      where: { id: job.id },
      include: { result: true },
    });
    return NextResponse.json(done ?? job);
  } catch (e) {
    if (e instanceof Error && e.message === "QUOTA_EXCEEDED") {
      return NextResponse.json(
        {
          error: "Достигнут дневной лимит расчётов",
          fix: "Повторите завтра или уменьшите число прогонов",
        },
        { status: 429 },
      );
    }
    if (e instanceof Error && e.message === "SCENARIO_NOT_FOUND") {
      return NextResponse.json(
        {
          error: "Нет активного сценария",
          fix: "Перейдите во вкладку «Сценарии» и активируйте сценарий",
        },
        { status: 400 },
      );
    }
    throw e;
  }
}
