import { prisma } from "@/shared/db";
import type { CashTransaction, Expense, Income } from "@/shared/types";
import {
  SUMMARY_EXPENSE_NAME,
  SUMMARY_INCOME_NAME,
  averageActualByCategory,
  scaleToMonthlyTotal,
} from "@/modules/budget/budget-summary";

function asDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

/** Apply summary income total to templates without double-counting. */
export async function applySummaryIncomeTotal(
  userId: string,
  targetMonthly: number,
  incomes: Income[],
): Promise<Income[]> {
  if (incomes.length === 0) {
    const row = await prisma.income.create({
      data: {
        userId,
        name: SUMMARY_INCOME_NAME,
        source: "OTHER",
        category: "general",
        amount: targetMonthly,
        frequency: "MONTHLY",
        isEssential: true,
        taxRatePct: 13,
        growthRatePct: 0,
      },
    });
    return [row as Income];
  }
  if (incomes.length === 1) {
    const only = incomes[0]!;
    const row = await prisma.income.update({
      where: { id: only.id },
      data: { amount: targetMonthly, frequency: "MONTHLY" },
    });
    return [row as Income];
  }
  const scaled = scaleToMonthlyTotal(incomes, targetMonthly);
  const next: Income[] = [];
  for (const s of scaled) {
    next.push(
      (await prisma.income.update({
        where: { id: s.id },
        data: { amount: s.amount },
      })) as Income,
    );
  }
  return next;
}

export async function applySummaryExpenseTotal(
  userId: string,
  targetMonthly: number,
  expenses: Expense[],
): Promise<Expense[]> {
  if (expenses.length === 0) {
    const row = await prisma.expense.create({
      data: {
        userId,
        name: SUMMARY_EXPENSE_NAME,
        category: "general",
        amount: targetMonthly,
        frequency: "MONTHLY",
        isEssential: true,
        growthRatePct: 0,
      },
    });
    return [row as Expense];
  }
  if (expenses.length === 1) {
    const only = expenses[0]!;
    const row = await prisma.expense.update({
      where: { id: only.id },
      data: { amount: targetMonthly, frequency: "MONTHLY" },
    });
    return [row as Expense];
  }
  const scaled = scaleToMonthlyTotal(expenses, targetMonthly);
  const next: Expense[] = [];
  for (const s of scaled) {
    next.push(
      (await prisma.expense.update({
        where: { id: s.id },
        data: { amount: s.amount },
      })) as Expense,
    );
  }
  return next;
}

/**
 * Rebuild MONTHLY plan templates from average actuals by category.
 * Does not invent categories without txs; leaves unmatched templates untouched
 * only when they have no category actual — categories with actuals upsert one line each.
 */
export async function syncPlanFromActuals(params: {
  userId: string;
  months: number;
  incomes: Income[];
  expenses: Expense[];
  txs: CashTransaction[];
}): Promise<{ incomes: Income[]; expenses: Expense[] }> {
  const { userId, months, incomes, expenses, txs } = params;
  const end = new Date();
  const expAvg = averageActualByCategory(txs, "expense", months, end);
  const incAvg = averageActualByCategory(txs, "income", months, end);

  let nextExpenses = [...expenses];
  for (const [categoryId, monthly] of expAvg) {
    if (monthly < 1) continue;
    const existing = nextExpenses.filter((e) => e.category === categoryId);
    if (existing.length === 0) {
      const created = (await prisma.expense.create({
        data: {
          userId,
          name:
            categoryId === "general"
              ? SUMMARY_EXPENSE_NAME
              : `План · ${categoryId.slice(0, 8)}`,
          category: categoryId,
          amount: monthly,
          frequency: "MONTHLY",
          isEssential: true,
          growthRatePct: 0,
        },
      })) as Expense;
      // Prefer category name from later UI; keep short placeholder if unknown
      nextExpenses = [...nextExpenses, created];
    } else if (existing.length === 1) {
      const row = (await prisma.expense.update({
        where: { id: existing[0]!.id },
        data: { amount: monthly, frequency: "MONTHLY" },
      })) as Expense;
      nextExpenses = nextExpenses.map((e) => (e.id === row.id ? row : e));
    } else {
      const scaled = scaleToMonthlyTotal(existing, monthly);
      for (const s of scaled) {
        const row = (await prisma.expense.update({
          where: { id: s.id },
          data: { amount: s.amount },
        })) as Expense;
        nextExpenses = nextExpenses.map((e) => (e.id === row.id ? row : e));
      }
    }
  }

  let nextIncomes = [...incomes];
  for (const [categoryId, monthly] of incAvg) {
    if (monthly < 1) continue;
    const existing = nextIncomes.filter(
      (i) => (i.category ?? "general") === categoryId,
    );
    if (existing.length === 0) {
      const created = (await prisma.income.create({
        data: {
          userId,
          name:
            categoryId === "general"
              ? SUMMARY_INCOME_NAME
              : `План · ${categoryId.slice(0, 8)}`,
          source: "OTHER",
          category: categoryId,
          amount: monthly,
          frequency: "MONTHLY",
          isEssential: true,
          taxRatePct: 13,
          growthRatePct: 0,
        },
      })) as Income;
      nextIncomes = [...nextIncomes, created];
    } else if (existing.length === 1) {
      const row = (await prisma.income.update({
        where: { id: existing[0]!.id },
        data: { amount: monthly, frequency: "MONTHLY" },
      })) as Income;
      nextIncomes = nextIncomes.map((i) => (i.id === row.id ? row : i));
    } else {
      const scaled = scaleToMonthlyTotal(existing, monthly);
      for (const s of scaled) {
        const row = (await prisma.income.update({
          where: { id: s.id },
          data: { amount: s.amount },
        })) as Income;
        nextIncomes = nextIncomes.map((i) => (i.id === row.id ? row : i));
      }
    }
  }

  return { incomes: nextIncomes, expenses: nextExpenses };
}

export function recentTransactions(
  txs: CashTransaction[],
  months: number,
  end = new Date(),
): CashTransaction[] {
  const start = new Date(end.getFullYear(), end.getMonth() - (months - 1), 1);
  return txs.filter((t) => {
    const d = asDate(t.date);
    return d >= start && d <= end;
  });
}
