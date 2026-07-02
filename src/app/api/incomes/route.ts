import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/shared/api-validation";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";

const schema = z.object({
  name: z.string().min(1),
  source: z.enum(["SALARY", "FREELANCE", "PASSIVE", "BUSINESS", "OTHER"]),
  amount: z.number().nonnegative(),
  currency: z.string().default("RUB"),
  frequency: z.enum(["MONTHLY", "YEARLY", "ONE_TIME"]).default("MONTHLY"),
  taxRatePct: z.number().default(13),
  growthRatePct: z.number().default(0),
});

export async function GET() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  return NextResponse.json(
    await prisma.income.findMany({ where: { userId } }),
  );
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const parsed = parseJsonBody(schema, await req.json());
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;
  const row = await prisma.income.create({ data: { ...data, userId } });
  return NextResponse.json(row, { status: 201 });
}
