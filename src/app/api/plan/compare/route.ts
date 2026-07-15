import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/shared/session";
import { loadPlanInputForUser } from "@/modules/plan/plan-data.service";
import { runDeterministicPlan } from "@/modules/plan/cashflow.engine";
import { prisma } from "@/shared/db";
import { resolveScenarioModifiers } from "@/modules/scenarios/scenario-modifiers";

/** Compare multiple scenarios side-by-side */
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const idsParam = new URL(req.url).searchParams.get("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);

  const planInput = await loadPlanInputForUser(userId);
  const scenarios = await prisma.scenario.findMany({ where: { userId } });

  const selected =
    ids.length > 0
      ? scenarios.filter((s) => ids.includes(s.id))
      : scenarios.slice(0, 6);

  const baseResult = runDeterministicPlan(planInput, undefined);
  const comparisons = [
    {
      scenarioId: null as string | null,
      name: "Базовый (без правил)",
      isActive: false,
      summary: baseResult.summary,
      monthly: baseResult.monthly
        .filter((_, i) => i % 12 === 0 || i === baseResult.monthly.length - 1)
        .map((m) => ({ month: m.month, netWorth: m.netWorth })),
    },
    ...selected.map((s) => {
      const modifiers = resolveScenarioModifiers(
        (s.params as Record<string, unknown>) ?? {},
        s.rules,
        planInput,
      );
      const result = runDeterministicPlan(planInput, modifiers);
      return {
        scenarioId: s.id,
        name: s.name,
        isActive: s.isActive,
        summary: result.summary,
        monthly: result.monthly
          .filter((_, i) => i % 12 === 0 || i === result.monthly.length - 1)
          .map((m) => ({ month: m.month, netWorth: m.netWorth })),
      };
    }),
  ];

  return NextResponse.json({ comparisons });
}
