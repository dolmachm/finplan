import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/shared/api-validation";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import { enqueueSimulation } from "@/modules/simulation/simulation.service";

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
  numRuns: z.number().int().min(1000).max(10000).optional(),
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
      numRuns: body.numRuns ?? 5000,
    });

    const { processSimulationJob } = await import(
      "@/modules/simulation/simulation.service"
    );
    void processSimulationJob(job.id);

    return NextResponse.json(job, { status: 202 });
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
