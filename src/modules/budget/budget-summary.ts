import { monthlyEquivalent } from "@/modules/plan/frequency";
import type { PlanFrequency } from "@/modules/plan/frequency";
import type {
  BudgetCategory,
  CashTransaction,
  Expense,
  Frequency,
  Income,
} from "@/shared/types";
import { liveCashflow } from "@/modules/finance/live-cash";
import {
  budgetExpenseFloor,
  envelopeStatuses,
  type EnvelopeStatus,
} from "@/modules/budget/envelopes";

export const SUMMARY_INCOME_NAME = "Доходы (сводка)";
export const SUMMARY_EXPENSE_NAME = "Расходы (сводка)";

function asDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

export function transactionsInMonth(
  txs: CashTransaction[],
  year: number,
  month: number,
): CashTransaction[] {
  return txs.filter((t) => {
    const d = asDate(t.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
}

export function actualByCategory(
  txs: CashTransaction[],
  kind: "income" | "expense",
): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.kind !== kind) continue;
    const key = t.category?.trim() || "general";
    map.set(key, (map.get(key) ?? 0) + t.amount);
  }
  return map;
}

export type EnvelopeMonthStatus = EnvelopeStatus & {
  actualMonthly: number;
  /** Against limit if set, else against planned */
  remainingVsLimit: number | null;
  overspentActual: boolean;
};

export function envelopeMonthStatuses(
  expenses: Expense[],
  categories: BudgetCategory[],
  monthTxs: CashTransaction[],
): EnvelopeMonthStatus[] {
  const base = envelopeStatuses(expenses, categories);
  const actual = actualByCategory(monthTxs, "expense");
  return base.map((s) => {
    const actualMonthly = actual.get(s.categoryId) ?? 0;
    const cap = s.monthlyLimit ?? s.plannedMonthly;
    const remainingVsLimit =
      s.monthlyLimit != null ? s.monthlyLimit - actualMonthly : null;
    return {
      ...s,
      actualMonthly,
      remainingVsLimit,
      overspentActual:
        s.monthlyLimit != null
          ? actualMonthly > s.monthlyLimit + 0.01
          : cap > 0 && actualMonthly > cap + 0.01,
    };
  });
}

export type BudgetSummary = {
  incomeMonthly: number;
  expenseMonthly: number;
  deltaMonthly: number;
  surplusMonthly: number;
  afterEnvelopesMonthly: number;
  floorMonthly: number;
  limitTotal: number;
  actualIncomeMonth: number;
  actualExpenseMonth: number;
  actualDeltaMonth: number;
  /** План по категориям (не general) */
  categorizedExpenseMonthly: number;
  /** Сводка − категории; >0 = ещё не разнесено */
  unallocatedExpenseMonthly: number;
  categorizedIncomeMonthly: number;
  unallocatedIncomeMonthly: number;
};

export function buildBudgetSummary(input: {
  incomes: Income[];
  expenses: Expense[];
  assets: Parameters<typeof liveCashflow>[0]["assets"];
  liabilities: Parameters<typeof liveCashflow>[0]["liabilities"];
  budgetCategories: BudgetCategory[];
  monthTxs: CashTransaction[];
}): BudgetSummary {
  const cash = liveCashflow(input);
  const floor = budgetExpenseFloor(input.expenses, input.budgetCategories);
  const limitTotal = input.budgetCategories
    .filter((c) => c.kind === "expense" && c.monthlyLimit != null)
    .reduce((s, c) => s + (c.monthlyLimit as number), 0);
  const afterEnvelopesMonthly =
    cash.incomeMonthly +
    cash.dividendMonthly -
    floor -
    cash.debtServiceMonthly -
    cash.maintenanceMonthly;

  let actualIncomeMonth = 0;
  let actualExpenseMonth = 0;
  for (const t of input.monthTxs) {
    if (t.kind === "income") actualIncomeMonth += t.amount;
    else actualExpenseMonth += t.amount;
  }

  const categorizedExpenseMonthly = input.expenses
    .filter((e) => e.category && e.category !== "general")
    .reduce(
      (s, e) => s + monthlyEquivalent(e.amount, e.frequency as PlanFrequency),
      0,
    );
  const categorizedIncomeMonthly = input.incomes
    .filter((i) => i.category && i.category !== "general")
    .reduce(
      (s, i) => s + monthlyEquivalent(i.amount, i.frequency as PlanFrequency),
      0,
    );

  return {
    incomeMonthly: cash.incomeMonthly,
    expenseMonthly: cash.expenseMonthly,
    deltaMonthly: cash.incomeMonthly - cash.expenseMonthly,
    surplusMonthly: cash.surplusMonthly,
    afterEnvelopesMonthly,
    floorMonthly: floor,
    limitTotal,
    actualIncomeMonth,
    actualExpenseMonth,
    actualDeltaMonth: actualIncomeMonth - actualExpenseMonth,
    categorizedExpenseMonthly,
    unallocatedExpenseMonthly: Math.max(
      0,
      cash.expenseMonthly - categorizedExpenseMonthly,
    ),
    categorizedIncomeMonthly,
    unallocatedIncomeMonthly: Math.max(
      0,
      cash.incomeMonthly - categorizedIncomeMonthly,
    ),
  };
}

/** Scale template amounts so monthlyEquivalent sum equals target. */
export function scaleToMonthlyTotal<
  T extends { amount: number; frequency: Frequency },
>(rows: T[], targetMonthly: number): T[] {
  if (rows.length === 0) return rows;
  const current = rows.reduce(
    (s, r) => s + monthlyEquivalent(r.amount, r.frequency as PlanFrequency),
    0,
  );
  if (current <= 0.01) {
    const first = rows[0]!;
    return rows.map((r, i) =>
      i === 0
        ? { ...r, amount: targetMonthly, frequency: "MONTHLY" as Frequency }
        : { ...r, amount: 0 },
    );
  }
  const factor = targetMonthly / current;
  return rows.map((r) => ({ ...r, amount: Math.round(r.amount * factor * 100) / 100 }));
}

export function averageActualByCategory(
  txs: CashTransaction[],
  kind: "income" | "expense",
  months: number,
  end = new Date(),
): Map<string, number> {
  const start = new Date(end.getFullYear(), end.getMonth() - (months - 1), 1);
  const relevant = txs.filter((t) => {
    if (t.kind !== kind) return false;
    const d = asDate(t.date);
    return d >= start && d <= end;
  });
  const sums = actualByCategory(relevant, kind);
  const out = new Map<string, number>();
  for (const [k, v] of sums) {
    out.set(k, Math.round((v / months) * 100) / 100);
  }
  return out;
}
