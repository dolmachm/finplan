import { NextResponse } from "next/server";
import { parseJsonBody } from "@/shared/api-validation";
import { budgetStructureSchema } from "@/shared/finance-schemas";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import {
  collapseToSummary,
  expandSummaryToCategories,
} from "@/modules/budget/sync-from-actuals";
import type { BudgetCategory, Expense, Income } from "@/shared/types";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const parsed = parseJsonBody(budgetStructureSchema, await req.json());
  if (!parsed.ok) return parsed.response;

  const [incomes, expenses, categories] = await Promise.all([
    prisma.income.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
    prisma.budgetCategory.findMany({ where: { userId } }),
  ]);

  try {
    const result =
      parsed.data.action === "collapse"
        ? await collapseToSummary({
            userId,
            kind: parsed.data.kind,
            incomes: incomes as Income[],
            expenses: expenses as Expense[],
          })
        : await expandSummaryToCategories({
            userId,
            kind: parsed.data.kind,
            incomes: incomes as Income[],
            expenses: expenses as Expense[],
            categories: categories as BudgetCategory[],
          });

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Error && e.message === "NO_CATEGORIES") {
      return NextResponse.json(
        {
          error:
            "Сначала добавьте категории — без них нечего разбивать.",
        },
        { status: 400 },
      );
    }
    throw e;
  }
}
