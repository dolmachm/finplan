import { NextResponse } from "next/server";
import { z } from "zod";
import type { InputJsonValue } from "@/shared/db";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import { PREDEFINED_SCENARIOS } from "@/modules/scenarios/scenario.templates";

export async function GET() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const scenarios = await prisma.scenario.findMany({ where: { userId } });
  return NextResponse.json({ scenarios, templates: PREDEFINED_SCENARIOS });
}

const createSchema = z.object({
  name: z.string().min(1),
  templateKey: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  rules: z.array(z.unknown()).optional(),
});

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const data = createSchema.parse(await req.json());
  const template = PREDEFINED_SCENARIOS.find((t) => t.key === data.templateKey);
  const row = await prisma.scenario.create({
    data: {
      userId,
      name: data.name,
      kind: data.templateKey ? "PREDEFINED" : "CUSTOM",
      templateKey: data.templateKey,
      params: (data.params ?? { templateKey: data.templateKey }) as InputJsonValue,
      rules: (data.rules ?? template?.rules ?? []) as InputJsonValue,
    },
  });
  return NextResponse.json(row, { status: 201 });
}
