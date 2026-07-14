import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import { recordRevision } from "@/shared/revision";

const schema = z.object({
  name: z.string().min(1),
  type: z.enum([
    "MORTGAGE",
    "CONSUMER_LOAN",
    "CREDIT_CARD",
    "AUTO_LOAN",
    "STUDENT_LOAN",
    "OTHER",
  ]),
  remainingBalance: z.number().nonnegative(),
  interestRatePct: z.number(),
  monthlyPayment: z.number().nonnegative(),
  endDate: z.string().datetime().optional(),
  currency: z.string().default("RUB"),
});

export async function GET() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  return NextResponse.json(
    await prisma.liability.findMany({ where: { userId } }),
  );
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const data = schema.parse(await req.json());
  const row = await prisma.liability.create({
    data: {
      ...data,
      userId,
      endDate: data.endDate ? new Date(data.endDate) : null,
    },
  });
  await recordRevision({
    userId,
    entityType: "liability",
    entityId: row.id,
    action: "CREATE",
    label: `Пассив добавлен: ${row.name}`,
    before: null,
    after: row,
  });
  return NextResponse.json(row, { status: 201 });
}
