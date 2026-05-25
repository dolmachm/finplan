import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";

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
  const data = schema.parse(await req.json());
  const macro = await prisma.macroSettings.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  return NextResponse.json(macro);
}
