import { NextResponse } from "next/server";
import { z } from "zod";
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
    include: { result: true },
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
  try {
    const body = postSchema.parse(await req.json());
    const active = await prisma.scenario.findFirst({
      where: { userId, isActive: true },
    });
    const job = await enqueueSimulation(userId, {
      scenarioId: body.scenarioId ?? active?.id,
      numRuns: body.numRuns ?? 5000,
    });

    // Фоновая обработка (dev/MVP без отдельного worker)
    const { processSimulationJob } = await import(
      "@/modules/simulation/simulation.service"
    );
    void processSimulationJob(job.id);

    return NextResponse.json(job, { status: 202 });
  } catch (e) {
    if (e instanceof Error && e.message === "QUOTA_EXCEEDED") {
      return NextResponse.json(
        { error: "Достигнут дневной лимит расчётов" },
        { status: 429 },
      );
    }
    throw e;
  }
}
