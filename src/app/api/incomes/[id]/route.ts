import { NextResponse } from "next/server";
import { parseJsonBody, notFoundResponse } from "@/shared/api-validation";
import { incomeSchema } from "@/shared/finance-schemas";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import { duplicateEntityResponse, isDuplicateIncome } from "@/shared/duplicate-check";

const patchSchema = incomeSchema.partial();

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;
  const current = await prisma.income.findFirst({ where: { id, userId } });
  if (!current) {
    return notFoundResponse();
  }
  const parsed = parseJsonBody(patchSchema, await req.json());
  if (!parsed.ok) return parsed.response;
  const merged = {
    name: parsed.data.name ?? current.name,
    source: parsed.data.source ?? current.source,
    amount: parsed.data.amount ?? current.amount,
    frequency: parsed.data.frequency ?? current.frequency,
  };
  const existing = await prisma.income.findMany({ where: { userId } });
  if (isDuplicateIncome(existing, merged, id)) {
    return duplicateEntityResponse("Доход");
  }
  const row = await prisma.income.update({
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
  const current = await prisma.income.findFirst({ where: { id, userId } });
  if (!current) {
    return notFoundResponse();
  }
  await prisma.income.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
