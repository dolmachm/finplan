import { NextResponse } from "next/server";
import { parseJsonBody } from "@/shared/api-validation";
import { incomeSchema } from "@/shared/finance-schemas";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import { duplicateEntityResponse, isDuplicateIncome } from "@/shared/duplicate-check";
import { recordRevision } from "@/shared/revision";

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
  const existing = await prisma.income.findMany({ where: { userId } });
  if (isDuplicateIncome(existing, parsed.data)) {
    return duplicateEntityResponse("Доход");
  }
  const row = await prisma.income.create({
    data: {
      ...parsed.data,
      category: parsed.data.category ?? "general",
      userId,
    },
  });
  void recordRevision({
    userId,
    entityType: "income",
    entityId: row.id,
    action: "CREATE",
    label: `Доход добавлен: ${row.name}`,
    before: null,
    after: row,
  }).catch(() => {});
  return NextResponse.json(row, { status: 201 });
}
