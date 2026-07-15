import { NextResponse } from "next/server";
import { parseJsonBody, notFoundResponse } from "@/shared/api-validation";
import { budgetCategorySchema } from "@/shared/finance-schemas";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";

const patchSchema = budgetCategorySchema.partial();

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;
  const current = await prisma.budgetCategory.findFirst({
    where: { id, userId },
  });
  if (!current) return notFoundResponse();

  const parsed = parseJsonBody(patchSchema, await req.json());
  if (!parsed.ok) return parsed.response;

  const kind = parsed.data.kind ?? current.kind;
  const monthlyLimit =
    kind === "income"
      ? null
      : parsed.data.monthlyLimit !== undefined
        ? parsed.data.monthlyLimit
        : current.monthlyLimit;

  const row = await prisma.budgetCategory.update({
    where: { id },
    data: {
      ...(parsed.data.name != null ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.kind != null ? { kind: parsed.data.kind } : {}),
      monthlyLimit,
      ...(parsed.data.sortOrder != null
        ? { sortOrder: parsed.data.sortOrder }
        : {}),
    },
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
  const current = await prisma.budgetCategory.findFirst({
    where: { id, userId },
  });
  if (!current) return notFoundResponse();

  const expenses = await prisma.expense.findMany({ where: { userId } });
  for (const e of expenses) {
    if (e.category === id) {
      await prisma.expense.update({
        where: { id: e.id },
        data: { category: "general" },
      });
    }
  }

  await prisma.budgetCategory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
