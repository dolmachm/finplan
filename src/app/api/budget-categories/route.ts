import { NextResponse } from "next/server";
import { parseJsonBody } from "@/shared/api-validation";
import { budgetCategorySchema } from "@/shared/finance-schemas";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/shared/finance-catalog";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";

async function ensureDefaults(userId: string) {
  const existing = await prisma.budgetCategory.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
  });
  if (existing.length > 0) return existing;
  const created = [];
  for (const def of DEFAULT_EXPENSE_CATEGORIES) {
    created.push(
      await prisma.budgetCategory.create({
        data: {
          userId,
          name: def.name,
          kind: "expense",
          monthlyLimit: null,
          sortOrder: def.sortOrder,
        },
      }),
    );
  }
  return created;
}

export async function GET() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const rows = await ensureDefaults(userId);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const parsed = parseJsonBody(budgetCategorySchema, await req.json());
  if (!parsed.ok) return parsed.response;

  const existing = await prisma.budgetCategory.findMany({ where: { userId } });
  const maxOrder = existing.reduce((m, c) => Math.max(m, c.sortOrder), -1);
  const kind = parsed.data.kind ?? "expense";
  const monthlyLimit =
    kind === "income" ? null : (parsed.data.monthlyLimit ?? null);

  const row = await prisma.budgetCategory.create({
    data: {
      userId,
      name: parsed.data.name.trim(),
      kind,
      monthlyLimit,
      sortOrder: parsed.data.sortOrder ?? maxOrder + 1,
    },
  });
  return NextResponse.json(row, { status: 201 });
}
