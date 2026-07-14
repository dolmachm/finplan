import { NextResponse } from "next/server";
import { parseJsonBody } from "@/shared/api-validation";
import { expenseSchema } from "@/shared/finance-schemas";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import { assertOwned } from "@/shared/crud";
import { duplicateEntityResponse, isDuplicateExpense } from "@/shared/duplicate-check";

const patchSchema = expenseSchema.partial();

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;
  if (!(await assertOwned("expense", id, userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const current = await prisma.expense.findFirst({ where: { id, userId } });
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const parsed = parseJsonBody(patchSchema, await req.json());
  if (!parsed.ok) return parsed.response;
  const merged = {
    name: parsed.data.name ?? current.name,
    category: parsed.data.category ?? current.category,
    amount: parsed.data.amount ?? current.amount,
    frequency: parsed.data.frequency ?? current.frequency,
  };
  const existing = await prisma.expense.findMany({ where: { userId } });
  if (isDuplicateExpense(existing, merged, id)) {
    return duplicateEntityResponse("Расход");
  }
  const row = await prisma.expense.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;
  if (!(await assertOwned("expense", id, userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
