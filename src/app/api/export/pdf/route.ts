import { NextResponse } from "next/server";
import { auth } from "@/shared/auth";
import { prisma } from "@/shared/db";
import {
  generatePlanPdf,
  REGULATORY_DISCLAIMER,
} from "@/modules/reports/pdf-export";
import { loadPlanInputForUser } from "@/modules/plan/plan-data.service";
import { runDeterministicPlan } from "@/modules/plan/cashflow.engine";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const [user, macro, goals, lastSim] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.macroSettings.findUnique({ where: { userId } }),
    prisma.goal.findMany({ where: { userId } }),
    prisma.simulationJob.findFirst({
      where: { userId, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      include: { result: true },
    }),
  ]);

  const planInput = await loadPlanInputForUser(userId);
  const det = runDeterministicPlan(planInput);
  const goalProbs = (lastSim?.result?.goalProbabilities ?? []) as Array<{
    goalId: string;
    probability: number;
  }>;

  const pdf = generatePlanPdf({
    userName: user?.name ?? user?.email ?? "User",
    generatedAt: new Date().toLocaleString("ru-RU"),
    disclaimer: REGULATORY_DISCLAIMER,
    assumptions: {
      inflation: macro?.baseInflationPct ?? 4,
      horizonYears: macro?.planHorizonYears ?? 30,
    },
    goals: goals.map((g) => {
      const prob = goalProbs.find((p) => p.goalId === g.id);
      return {
        name: g.name,
        target: g.targetAmountNominal,
        probability: prob?.probability,
      };
    }),
    summary: {
      finalNetWorth: det.summary.finalNetWorth,
      recommendedSaving: det.summary.recommendedMonthlySaving,
    },
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="finplan-report.pdf"',
    },
  });
}
