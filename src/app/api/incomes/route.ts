import { NextResponse } from "next/server";
import { parseJsonBody } from "@/shared/api-validation";
import { incomeSchema } from "@/shared/finance-schemas";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";

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
  const parsed = parseJsonBody(incomeSchema, await req.json());
  if (!parsed.ok) return parsed.response;
  const row = await prisma.income.create({ data: { ...parsed.data, userId } });
  return NextResponse.json(row, { status: 201 });
}
