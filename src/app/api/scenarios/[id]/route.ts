import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import { parseRulesFromJson } from "@/modules/scenarios/rule-engine";
import { validateRules } from "@/modules/scenarios/rule-validation";
import { loadPlanInputForUser } from "@/modules/plan/plan-data.service";
import type { ScenarioRule } from "@/modules/scenarios/rule.types";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  rules: z.array(z.unknown()).optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;

  const scenario = await prisma.scenario.findFirst({
    where: { id, userId },
  });
  if (!scenario) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(scenario);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;
  const body = patchSchema.parse(await req.json());

  const existing = await prisma.scenario.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let validation: ReturnType<typeof validateRules> = [];
  if (body.rules) {
    const planInput = await loadPlanInputForUser(userId);
    validation = validateRules(body.rules as ScenarioRule[], planInput);
    const errors = validation.filter((v) => v.level === "error");
    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", issues: validation },
        { status: 400 },
      );
    }
  }

  const scenario = await prisma.scenario.update({
    where: { id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.rules
        ? { rules: body.rules as unknown as Prisma.InputJsonValue }
        : {}),
      ...(body.params
        ? { params: body.params as unknown as Prisma.InputJsonValue }
        : {}),
    },
  });

  return NextResponse.json({ scenario, validation });
}
