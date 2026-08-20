import { NextResponse } from "next/server";
import { parseJsonBody } from "@/shared/api-validation";
import { budgetSyncFromActualsSchema } from "@/shared/finance-schemas";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import {
  recentTransactions,
  syncPlanFromActuals,
} from "@/modules/budget/sync-from-actuals";
import type { BudgetCategory, CashTransaction, Expense, Income } from "@/shared/types";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const parsed = parseJsonBody(budgetSyncFromActualsSchema, await req.json());
  if (!parsed.ok) return parsed.response;

  const months = parsed.data.months ?? 3;
  const [incomes, expenses, txs, categories] = await Promise.all([
    prisma.income.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
    prisma.cashTransaction.findMany({ where: { userId } }),
    prisma.budgetCategory.findMany({ where: { userId } }),
  ]);

  const catName = new Map(
    (categories as BudgetCategory[]).map((c) => [c.id, c.name]),
  );

  const result = await syncPlanFromActuals({
    userId,
    months,
    incomes: incomes as Income[],
    expenses: expenses as Expense[],
    txs: recentTransactions(txs as CashTransaction[], months),
  });

  // Rename placeholder plan lines to category names when possible
  const renamedExpenses = [];
  for (const e of result.expenses) {
    const label = catName.get(e.category);
    if (label && e.name.startsWith("План ·")) {
      renamedExpenses.push(
        await prisma.expense.update({
          where: { id: e.id },
          data: { name: label },
        }),
      );
    } else {
      renamedExpenses.push(e);
    }
  }
  const renamedIncomes = [];
  for (const i of result.incomes) {
    const label = catName.get(i.category);
    if (label && i.name.startsWith("План ·")) {
      renamedIncomes.push(
        await prisma.income.update({
          where: { id: i.id },
          data: { name: label },
        }),
      );
    } else {
      renamedIncomes.push(i);
    }
  }

  return NextResponse.json({
    incomes: renamedIncomes,
    expenses: renamedExpenses,
    months,
  });
}
