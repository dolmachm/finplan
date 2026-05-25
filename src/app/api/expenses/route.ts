import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";

const schema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  amount: z.number().nonnegative(),
  currency: z.string().default("RUB"),
  frequency: z.enum(["MONTHLY", "YEARLY", "ONE_TIME"]).default("MONTHLY"),
  isEssential: z.boolean().default(true),
  growthRatePct: z.number().default(0),
});

export async function GET() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  return NextResponse.json(
    await prisma.expense.findMany({ where: { userId } }),
  );
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const data = schema.parse(await req.json());
  const row = await prisma.expense.create({ data: { ...data, userId } });
  return NextResponse.json(row, { status: 201 });
}
