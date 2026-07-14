import { notFoundResponse } from "@/shared/api-validation";
import { NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import { parseRulesFromJson } from "@/modules/scenarios/rule-engine";
import { validateRules } from "@/modules/scenarios/rule-validation";
import { loadPlanInputForUser } from "@/modules/plan/plan-data.service";
import type { ScenarioRule } from "@/modules/scenarios/rule.types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;

  const scenario = await prisma.scenario.findFirst({
    where: { id, userId },
  });
  if (!scenario) {
    return notFoundResponse();
  }

  const body = await req.json().catch(() => ({}));
  const rules = (body.rules ?? scenario.rules) as ScenarioRule[];
  const planInput = await loadPlanInputForUser(userId);
  const issues = validateRules(
    Array.isArray(body.rules) ? rules : parseRulesFromJson(rules),
    planInput,
  );

  return NextResponse.json({
    issues,
    valid: !issues.some((i) => i.level === "error"),
  });
}
