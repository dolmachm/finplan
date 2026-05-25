import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";

const schema = z.object({
  name: z.string().min(1),
  targetAmountNominal: z.number().positive(),
  targetDate: z.string().datetime(),
  currency: z.string().default("RUB"),
  priority: z.number().int().default(1),
});

export async function GET() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  return NextResponse.json(await prisma.goal.findMany({ where: { userId } }));
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const data = schema.parse(await req.json());
  const row = await prisma.goal.create({
    data: {
      ...data,
      userId,
      targetDate: new Date(data.targetDate),
    },
  });
  return NextResponse.json(row, { status: 201 });
}
