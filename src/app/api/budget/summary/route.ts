import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/shared/api-validation";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import {
  applySummaryExpenseTotal,
  applySummaryIncomeTotal,
} from "@/modules/budget/sync-from-actuals";
import type { Expense, Income } from "@/shared/types";

const bodySchema = z.object({
  incomeMonthly: z.number().nonnegative().optional(),
  expenseMonthly: z.number().nonnegative().optional(),
});

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const parsed = parseJsonBody(bodySchema, await req.json());
  if (!parsed.ok) return parsed.response;

  const [incomes, expenses] = await Promise.all([
    prisma.income.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
  ]);

  let nextIncomes = incomes as Income[];
  let nextExpenses = expenses as Expense[];

  if (parsed.data.incomeMonthly != null) {
    nextIncomes = await applySummaryIncomeTotal(
      userId,
      parsed.data.incomeMonthly,
      nextIncomes,
    );
  }
  if (parsed.data.expenseMonthly != null) {
    nextExpenses = await applySummaryExpenseTotal(
      userId,
      parsed.data.expenseMonthly,
      nextExpenses,
    );
  }

  return NextResponse.json({ incomes: nextIncomes, expenses: nextExpenses });
}
