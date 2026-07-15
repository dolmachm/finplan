import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/shared/session";
import { loadPlanInputForUser } from "@/modules/plan/plan-data.service";
import { runDeterministicPlan } from "@/modules/plan/cashflow.engine";
import { prisma } from "@/shared/db";
import { resolveScenarioModifiers } from "@/modules/scenarios/scenario-modifiers";

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const scenarioIdParam = new URL(req.url).searchParams.get("scenarioId");

  let selectedScenario = null;
  if (scenarioIdParam === "base") {
    selectedScenario = null;
  } else if (scenarioIdParam) {
    selectedScenario = await prisma.scenario.findFirst({
      where: { id: scenarioIdParam, userId },
    });
    if (!selectedScenario) {
      return NextResponse.json({ error: "Сценарий не найден" }, { status: 404 });
    }
  } else {
    selectedScenario = await prisma.scenario.findFirst({
      where: { userId, isActive: true },
    });
  }

  const planInput = await loadPlanInputForUser(userId);
  const modifiers = selectedScenario
    ? resolveScenarioModifiers(
        (selectedScenario.params as Record<string, unknown>) ?? {},
        selectedScenario.rules,
        planInput,
      )
    : undefined;

  const result = runDeterministicPlan(planInput, modifiers);

  return NextResponse.json({
    result,
    scenario: selectedScenario?.name ?? "Базовый",
    scenarioId: selectedScenario?.id ?? null,
    isActive: selectedScenario?.isActive ?? false,
    disclaimer:
      "Результаты носят информационный характер и не являются индивидуальной инвестиционной рекомендацией.",
  });
}
