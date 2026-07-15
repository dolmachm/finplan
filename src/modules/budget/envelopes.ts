import { monthlyEquivalent } from "@/modules/plan/frequency";
import type { BudgetCategory, Expense } from "@/shared/types";
import type { PlanFrequency } from "@/modules/plan/frequency";

export type EnvelopeStatus = {
  categoryId: string;
  name: string;
  plannedMonthly: number;
  monthlyLimit: number | null;
  /** limit - planned; null if no limit */
  remaining: number | null;
  overspent: boolean;
};

export function plannedByCategory(expenses: Expense[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of expenses) {
    const key = e.category?.trim() || "general";
    const add = monthlyEquivalent(e.amount, e.frequency as PlanFrequency);
    map.set(key, (map.get(key) ?? 0) + add);
  }
  return map;
}

/**
 * Reserved monthly spend for planning surplus:
 * max(sum of planned expenses, sum of set category limits).
 * When no limits are set, equals planned total (current behaviour).
 */
export function budgetExpenseFloor(
  expenses: Expense[],
  categories: BudgetCategory[],
): number {
  const planned = expenses.reduce(
    (s, e) => s + monthlyEquivalent(e.amount, e.frequency as PlanFrequency),
    0,
  );
  const limitSum = categories
    .filter((c) => c.kind === "expense" && c.monthlyLimit != null)
    .reduce((s, c) => s + (c.monthlyLimit as number), 0);
  return Math.max(planned, limitSum);
}

export function envelopeStatuses(
  expenses: Expense[],
  categories: BudgetCategory[],
): EnvelopeStatus[] {
  const planned = plannedByCategory(expenses);
  return categories
    .filter((c) => c.kind === "expense")
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ru"))
    .map((c) => {
      const plannedMonthly = planned.get(c.id) ?? 0;
      const limit = c.monthlyLimit;
      const remaining = limit == null ? null : limit - plannedMonthly;
      return {
        categoryId: c.id,
        name: c.name,
        plannedMonthly,
        monthlyLimit: limit,
        remaining,
        overspent: remaining != null && remaining < -0.01,
      };
    });
}

export type EnvelopeOverviewSummary = {
  statuses: EnvelopeStatus[];
  /** Categories with activity or a set limit — good for compact UI */
  active: EnvelopeStatus[];
  plannedTotal: number;
  limitTotal: number;
  hasLimits: boolean;
  overspentCount: number;
};

export function envelopeOverviewSummary(
  expenses: Expense[],
  categories: BudgetCategory[],
): EnvelopeOverviewSummary {
  const statuses = envelopeStatuses(expenses, categories);
  const plannedTotal = expenses.reduce(
    (s, e) => s + monthlyEquivalent(e.amount, e.frequency as PlanFrequency),
    0,
  );
  const limitTotal = statuses
    .filter((s) => s.monthlyLimit != null)
    .reduce((s, e) => s + (e.monthlyLimit as number), 0);
  const active = statuses.filter(
    (s) => s.plannedMonthly > 0.01 || s.monthlyLimit != null,
  );
  return {
    statuses,
    active,
    plannedTotal,
    limitTotal,
    hasLimits: limitTotal > 0,
    overspentCount: statuses.filter((s) => s.overspent).length,
  };
}

/** Synthetic monthly expense line so existing iPlan budget math respects envelope floor */
export function envelopeReserveBudgetLine(
  expenses: Expense[],
  categories: BudgetCategory[],
): {
  id: string;
  name: string;
  amount: number;
  frequency: "MONTHLY";
  startDate: null;
  endDate: null;
} | null {
  const planned = expenses.reduce(
    (s, e) => s + monthlyEquivalent(e.amount, e.frequency as PlanFrequency),
    0,
  );
  const floor = budgetExpenseFloor(expenses, categories);
  const extra = floor - planned;
  if (extra <= 0.01) return null;
  return {
    id: "__envelope_reserve__",
    name: "Резерв конвертов",
    amount: extra,
    frequency: "MONTHLY",
    startDate: null,
    endDate: null,
  };
}
