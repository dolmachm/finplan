import { prisma } from "@/shared/db";
import { monthlyEquivalent } from "@/modules/plan/frequency";
import type { PlanFrequency } from "@/modules/plan/frequency";
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

/** Свернуть все строки в одну сводную MONTHLY. */
export async function collapseToSummary(params: {
  userId: string;
  kind: "income" | "expense";
  incomes: Income[];
  expenses: Expense[];
}): Promise<{ incomes: Income[]; expenses: Expense[] }> {
  const { userId, kind, incomes, expenses } = params;
  if (kind === "expense") {
    const total = expenses.reduce(
      (s, e) => s + monthlyEq(e.amount, e.frequency),
      0,
    );
    for (const e of expenses) {
      await prisma.expense.delete({ where: { id: e.id } });
    }
    if (total < 0.01) return { incomes, expenses: [] };
    const row = (await prisma.expense.create({
      data: {
        userId,
        name: SUMMARY_EXPENSE_NAME,
        category: "general",
        amount: Math.round(total * 100) / 100,
        frequency: "MONTHLY",
        isEssential: true,
        growthRatePct: 0,
      },
    })) as Expense;
    return { incomes, expenses: [row] };
  }

  const total = incomes.reduce(
    (s, i) => s + monthlyEq(i.amount, i.frequency),
    0,
  );
  for (const i of incomes) {
    await prisma.income.delete({ where: { id: i.id } });
  }
  if (total < 0.01) return { incomes: [], expenses };
  const row = (await prisma.income.create({
    data: {
      userId,
      name: SUMMARY_INCOME_NAME,
      source: "OTHER",
      category: "general",
      amount: Math.round(total * 100) / 100,
      frequency: "MONTHLY",
      isEssential: true,
      taxRatePct: 13,
      growthRatePct: 0,
    },
  })) as Income;
  return { incomes: [row], expenses };
}

/**
 * Разбить сводку по пользовательским категориям (равные доли или по лимитам).
 * Требует хотя бы одну BudgetCategory нужного kind.
 */
export async function expandSummaryToCategories(params: {
  userId: string;
  kind: "income" | "expense";
  incomes: Income[];
  expenses: Expense[];
  categories: Array<{ id: string; name: string; kind: string; monthlyLimit: number | null }>;
}): Promise<{ incomes: Income[]; expenses: Expense[] }> {
  const { userId, kind, incomes, expenses, categories } = params;
  const cats = categories.filter((c) => c.kind === kind);
  if (cats.length === 0) {
    throw new Error("NO_CATEGORIES");
  }

  if (kind === "expense") {
    const total = expenses.reduce(
      (s, e) => s + monthlyEq(e.amount, e.frequency),
      0,
    );
    for (const e of expenses) {
      await prisma.expense.delete({ where: { id: e.id } });
    }
    const weights = cats.map((c) =>
      c.monthlyLimit != null && c.monthlyLimit > 0 ? c.monthlyLimit : 1,
    );
    const wSum = weights.reduce((a, b) => a + b, 0) || cats.length;
    const created: Expense[] = [];
    let allocated = 0;
    for (let i = 0; i < cats.length; i++) {
      const c = cats[i]!;
      const share =
        i === cats.length - 1
          ? Math.max(0, Math.round((total - allocated) * 100) / 100)
          : Math.round(((total * weights[i]!) / wSum) * 100) / 100;
      allocated += share;
      created.push(
        (await prisma.expense.create({
          data: {
            userId,
            name: c.name,
            category: c.id,
            amount: share,
            frequency: "MONTHLY",
            isEssential: true,
            growthRatePct: 0,
          },
        })) as Expense,
      );
    }
    return { incomes, expenses: created };
  }

  const total = incomes.reduce(
    (s, i) => s + monthlyEq(i.amount, i.frequency),
    0,
  );
  for (const i of incomes) {
    await prisma.income.delete({ where: { id: i.id } });
  }
  const created: Income[] = [];
  let allocated = 0;
  const each = total / cats.length;
  for (let i = 0; i < cats.length; i++) {
    const c = cats[i]!;
    const share =
      i === cats.length - 1
        ? Math.max(0, Math.round((total - allocated) * 100) / 100)
        : Math.round(each * 100) / 100;
    allocated += share;
    created.push(
      (await prisma.income.create({
        data: {
          userId,
          name: c.name,
          source: "OTHER",
          category: c.id,
          amount: share,
          frequency: "MONTHLY",
          isEssential: true,
          taxRatePct: 13,
          growthRatePct: 0,
        },
      })) as Income,
    );
  }
  return { incomes: created, expenses };
}

function monthlyEq(amount: number, frequency: string): number {
  return monthlyEquivalent(amount, frequency as PlanFrequency);
}
