import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireUserId, isErrorResponse } from "@/shared/session";
import { loadPlanInputForUser } from "@/modules/plan/plan-data.service";
import { runDeterministicPlan } from "@/modules/plan/cashflow.engine";
import { prisma } from "@/shared/db";
import { resolveScenarioModifiers } from "@/modules/scenarios/scenario-modifiers";

export async function GET() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const activeScenario = await prisma.scenario.findFirst({
    where: { userId, isActive: true },
  });

  const planInput = await loadPlanInputForUser(userId);
  const modifiers = activeScenario
    ? resolveScenarioModifiers(
        (activeScenario.params as Record<string, unknown>) ?? {},
        activeScenario.rules,
        planInput,
      )
    : undefined;

  const result = runDeterministicPlan(planInput, modifiers);

  await prisma.planSnapshot.create({
    data: {
      userId,
      scenarioId: activeScenario?.id,
      deterministic: result as unknown as Prisma.InputJsonValue,
      cashflowMonthly: result.monthly.map((m) => m.cashflow) as unknown as Prisma.InputJsonValue,
      netWorthMonthly: result.monthly.map((m) => m.netWorth) as unknown as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({
    result,
    scenario: activeScenario?.name ?? "Базовый",
    disclaimer:
      "Результаты носят информационный характер и не являются индивидуальной инвестиционной рекомендацией.",
  });
}
