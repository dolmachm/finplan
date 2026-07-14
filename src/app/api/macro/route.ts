import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/shared/api-validation";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import { recordRevision } from "@/shared/revision";

const schema = z.object({
  baseCurrency: z.string().optional(),
  baseInflationPct: z.number().optional(),
  incomeTaxPct: z.number().optional(),
  planHorizonYears: z.number().int().min(1).max(50).optional(),
  discountRatePct: z.number().optional().nullable(),
});

export async function GET() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const macro = await prisma.macroSettings.findUnique({ where: { userId } });
  return NextResponse.json(macro);
}

export async function PATCH(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const before = await prisma.macroSettings.findUnique({ where: { userId } });
  const parsed = parseJsonBody(schema, await req.json());
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;
  const macro = await prisma.macroSettings.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  await recordRevision({
    userId,
    entityType: "macro",
    entityId: macro.id,
    action: before ? "UPDATE" : "CREATE",
    label: "Макропараметры плана обновлены",
    before,
    after: macro,
  });
  return NextResponse.json(macro);
}
