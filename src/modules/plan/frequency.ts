import type { Frequency } from "@/shared/types";

export const FREQUENCY_VALUES = [
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "YEARLY",
  "ONE_TIME",
] as const satisfies readonly Frequency[];

export type PlanFrequency = Frequency;

export function amountForMonth(
  amount: number,
  frequency: PlanFrequency,
  month: number,
): number {
  switch (frequency) {
    case "MONTHLY":
      return amount;
    case "QUARTERLY":
      return month % 3 === 0 ? amount : 0;
    case "SEMI_ANNUAL":
      return month % 6 === 0 ? amount : 0;
    case "YEARLY":
      return month % 12 === 0 ? amount : 0;
    case "ONE_TIME":
      return month === 0 ? amount : 0;
  }
}

export function monthlyEquivalent(
  amount: number,
  frequency: PlanFrequency,
): number {
  switch (frequency) {
    case "MONTHLY":
      return amount;
    case "QUARTERLY":
      return amount / 3;
    case "SEMI_ANNUAL":
      return amount / 6;
    case "YEARLY":
      return amount / 12;
    case "ONE_TIME":
      return 0;
  }
}

export function monthlyTotal(
  rows: Array<{ amount: number; frequency: string }>,
): number {
  return rows.reduce(
    (s, r) => s + monthlyEquivalent(r.amount, r.frequency as PlanFrequency),
    0,
  );
}

export function monthlyNetIncome(
  incomes: Array<{ amount: number; frequency: string; taxRatePct?: number }>,
): number {
  return incomes.reduce(
    (s, i) =>
      s +
      monthlyEquivalent(i.amount, i.frequency as PlanFrequency) *
        (1 - (i.taxRatePct ?? 0) / 100),
    0,
  );
}
