import { monthlyEquivalent } from "@/modules/plan/frequency";
import type { Frequency } from "@/shared/types";
import type { IPlanStreamFrequency } from "@/modules/iplan/types";

export type BudgetLine = {
  id: string;
  name: string;
  amount: number;
  frequency: Frequency;
  startYear: number | null;
  endYear: number | null;
};

function periodYears(startYear: number, endYear: number): number {
  if (!startYear || !endYear) return 0;
  const n = endYear - startYear + 1;
  return n >= 0 && n <= 199 ? n : 0;
}

function annualAmount(
  amount: number,
  frequency: IPlanStreamFrequency,
  yearsInPeriod: number,
): number {
  if (!amount || yearsInPeriod <= 0) return 0;
  switch (frequency) {
    case "MONTHLY":
      return amount * 12;
    case "QUARTERLY":
      return amount * 4;
    case "YEARLY":
      return amount;
    case "PERIOD":
      return amount / yearsInPeriod;
  }
}

export function activeInYear(
  year: number,
  startYear: number | null,
  endYear: number | null,
): boolean {
  if (startYear != null && year < startYear) return false;
  if (endYear != null && year > endYear) return false;
  return true;
}

export function annualFromFrequency(amount: number, frequency: Frequency): number {
  return monthlyEquivalent(amount, frequency) * 12;
}

export function budgetForYear(
  year: number,
  incomes: BudgetLine[],
  expenses: BudgetLine[],
): {
  incomeAnnual: number;
  expenseAnnual: number;
  surplusAnnual: number;
  surplusMonthly: number;
} {
  let incomeAnnual = 0;
  for (const i of incomes) {
    if (!activeInYear(year, i.startYear, i.endYear)) continue;
    incomeAnnual += annualFromFrequency(i.amount, i.frequency);
  }
  let expenseAnnual = 0;
  for (const e of expenses) {
    if (!activeInYear(year, e.startYear, e.endYear)) continue;
    expenseAnnual += annualFromFrequency(e.amount, e.frequency);
  }
  const surplusAnnual = incomeAnnual - expenseAnnual;
  return {
    incomeAnnual,
    expenseAnnual,
    surplusAnnual,
    surplusMonthly: surplusAnnual / 12,
  };
}

export function baselineMonthlySurplus(
  incomes: BudgetLine[],
  expenses: BudgetLine[],
  year = new Date().getFullYear(),
): number {
  return budgetForYear(year, incomes, expenses).surplusMonthly;
}

export function contributionAnnualTotal(
  streams: Array<{
    amount: number;
    frequency: IPlanStreamFrequency;
    startYear: number;
    endYear: number;
    enabled: boolean;
  }>,
  year: number,
): number {
  let total = 0;
  for (const s of streams) {
    if (!s.enabled) continue;
    const years = periodYears(s.startYear, s.endYear);
    if (years === 0 || year < s.startYear || year > s.endYear) continue;
    total += annualAmount(s.amount, s.frequency, years);
  }
  return total;
}

export function validateContributionsVsBudget(params: {
  contributions: Array<{
    amount: number;
    frequency: IPlanStreamFrequency;
    startYear: number;
    endYear: number;
    enabled: boolean;
  }>;
  incomes: BudgetLine[];
  expenses: BudgetLine[];
  startYear: number;
  horizonYears: number;
}):
  | { ok: true }
  | {
      ok: false;
      message: string;
      year: number;
      surplus: number;
      contrib: number;
    } {
  const horizon = Math.min(100, Math.max(1, params.horizonYears));
  for (let i = 0; i < horizon; i++) {
    const year = params.startYear + i;
    const { surplusAnnual } = budgetForYear(year, params.incomes, params.expenses);
    const contrib = contributionAnnualTotal(params.contributions, year);
    if (contrib > surplusAnnual + 0.01) {
      return {
        ok: false,
        year,
        surplus: surplusAnnual,
        contrib,
        message: `В ${year} г. взносы (${Math.round(contrib).toLocaleString("ru-RU")} ₽/год) превышают профицит доходов−расходов (${Math.round(surplusAnnual).toLocaleString("ru-RU")} ₽/год). Уменьшите взносы или скорректируйте данные на вкладке «Данные».`,
      };
    }
  }
  return { ok: true };
}

export function toBudgetLines(
  rows: Array<{
    id: string;
    name: string;
    amount: number;
    frequency: Frequency;
    startDate?: Date | null;
    endDate?: Date | null;
  }>,
): BudgetLine[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    amount: r.amount,
    frequency: r.frequency,
    startYear: r.startDate ? r.startDate.getFullYear() : null,
    endYear: r.endDate ? r.endDate.getFullYear() : null,
  }));
}
