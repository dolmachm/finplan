import { NextResponse } from "next/server";
import { parseJsonBody, notFoundResponse } from "@/shared/api-validation";
import { cashTransactionSchema } from "@/shared/finance-schemas";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";

const patchSchema = cashTransactionSchema.partial();

function parseTxDate(raw: string): Date {
  const d = new Date(raw.includes("T") ? raw : `${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) throw new Error("bad date");
  return d;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;
  const current = await prisma.cashTransaction.findFirst({
    where: { id, userId },
  });
  if (!current) return notFoundResponse();

  const parsed = parseJsonBody(patchSchema, await req.json());
  if (!parsed.ok) return parsed.response;

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.date != null) {
    try {
      data.date = parseTxDate(parsed.data.date);
    } catch {
      return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
    }
  }
  if (parsed.data.name != null) data.name = parsed.data.name.trim();

  const row = await prisma.cashTransaction.update({
    where: { id },
    data,
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
  const current = await prisma.cashTransaction.findFirst({
    where: { id, userId },
  });
  if (!current) return notFoundResponse();
  await prisma.cashTransaction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
