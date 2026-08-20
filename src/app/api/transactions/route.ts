import { NextResponse } from "next/server";
import { parseJsonBody } from "@/shared/api-validation";
import { cashTransactionSchema } from "@/shared/finance-schemas";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import type { CashTransaction } from "@/shared/types";

function parseTxDate(raw: string): Date {
  const d = new Date(raw.includes("T") ? raw : `${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) throw new Error("bad date");
  return d;
}

function asDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

function inMonth(d: Date, year: number, month: number): boolean {
  return d.getFullYear() === year && d.getMonth() + 1 === month;
}

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year") ?? new Date().getFullYear());
  const month = Number(url.searchParams.get("month") ?? new Date().getMonth() + 1);

  const rows = (await prisma.cashTransaction.findMany({
    where: { userId },
    orderBy: { date: "desc" },
  })) as CashTransaction[];

  const filtered = rows.filter((r) => inMonth(asDate(r.date), year, month));
  return NextResponse.json(filtered);
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const parsed = parseJsonBody(cashTransactionSchema, await req.json());
  if (!parsed.ok) return parsed.response;

  let date: Date;
  try {
    date = parseTxDate(parsed.data.date);
  } catch {
    return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
  }

  const row = await prisma.cashTransaction.create({
    data: {
      userId,
      kind: parsed.data.kind,
      name: parsed.data.name.trim(),
      amount: parsed.data.amount,
      currency: parsed.data.currency ?? "RUB",
      category: parsed.data.category ?? "general",
      date,
      notes: parsed.data.notes ?? null,
    },
  });
  return NextResponse.json(row, { status: 201 });
}
