import { NextResponse } from "next/server";
import { parseJsonBody } from "@/shared/api-validation";
import { expenseSchema } from "@/shared/finance-schemas";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import { duplicateEntityResponse, isDuplicateExpense } from "@/shared/duplicate-check";
import { recordRevision } from "@/shared/revision";

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
  const parsed = parseJsonBody(expenseSchema, await req.json());
  if (!parsed.ok) return parsed.response;
  const existing = await prisma.expense.findMany({ where: { userId } });
  if (isDuplicateExpense(existing, parsed.data)) {
    return duplicateEntityResponse("Расход");
  }
  const row = await prisma.expense.create({ data: { ...parsed.data, userId } });
  void recordRevision({
    userId,
    entityType: "expense",
    entityId: row.id,
    action: "CREATE",
    label: `Расход добавлен: ${row.name}`,
    before: null,
    after: row,
  }).catch(() => {});
  return NextResponse.json(row, { status: 201 });
}
