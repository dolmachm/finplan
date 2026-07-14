import { NextResponse } from "next/server";
import { z } from "zod";
import type { InputJsonValue } from "@/shared/db";
import { prisma } from "@/shared/db";
import {
  notFoundResponse,
  parseJsonBody,
} from "@/shared/api-validation";
import { requireUserId, isErrorResponse } from "@/shared/session";
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
    return notFoundResponse();
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
  const parsed = parseJsonBody(patchSchema, await req.json());
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const existing = await prisma.scenario.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    return notFoundResponse();
  }

  let validation: ReturnType<typeof validateRules> = [];
  if (body.rules) {
    const planInput = await loadPlanInputForUser(userId);
    validation = validateRules(body.rules as ScenarioRule[], planInput);
    const errors = validation.filter((v) => v.level === "error");
    if (errors.length > 0) {
      return NextResponse.json(
        {
          error:
            "В правилах есть ошибки. Исправьте их и сохраните снова.",
          issues: validation,
        },
        { status: 400 },
      );
    }
  }

  const scenario = await prisma.scenario.update({
    where: { id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.rules
        ? { rules: body.rules as unknown as InputJsonValue }
        : {}),
      ...(body.params
        ? { params: body.params as unknown as InputJsonValue }
        : {}),
    },
  });

  return NextResponse.json({ scenario, validation });
}
