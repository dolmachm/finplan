import { monthlyEquivalent } from "@/modules/plan/frequency";
import type {
  Asset,
  BudgetCategory,
  Expense,
  Frequency,
  Income,
  Liability,
} from "@/shared/types";
import type { IPlanStreamFrequency } from "./types";
import { annualAmount, periodYears } from "./stream-math";
import { activeLiabilities } from "@/modules/finance/liability-status";
import { envelopeReserveBudgetLine } from "@/modules/budget/envelopes";

export type BudgetLine = {
  id: string;
  name: string;
  amount: number;
  frequency: Frequency;
  startYear: number | null;
  endYear: number | null;
};

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
    if (contrib <= 0.01) continue;
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

/** Тот же бюджет, что на Home/Плане: налог, дивиденды, долг, содержание активов. */
export function buildIPlanBudget(input: {
  incomes: Income[];
  expenses: Expense[];
  assets: Asset[];
  liabilities: Liability[];
  budgetCategories?: BudgetCategory[];
}): { budgetIncomes: BudgetLine[]; budgetExpenses: BudgetLine[] } {
  const budgetIncomes: BudgetLine[] = [
    ...toBudgetLines(
      input.incomes.map((i) => ({
        ...i,
        amount: i.amount * (1 - (i.taxRatePct ?? 0) / 100),
      })),
    ),
    ...input.assets
      .filter((a) => (a.dividendIncomeMonthly ?? 0) > 0)
      .map((a) => ({
        id: `div_${a.id}`,
        name: a.name,
        amount: a.dividendIncomeMonthly,
        frequency: "MONTHLY" as const,
        startYear: null,
        endYear: null,
      })),
  ];
  const debtLines = toBudgetLines(
    activeLiabilities(input.liabilities).map((l) => ({
      id: l.id,
      name: l.name,
      amount: l.monthlyPayment,
      frequency: "MONTHLY" as const,
    })),
  );
  const maintenanceLines = input.assets
    .filter((a) => (a.maintenanceCostMonthly ?? 0) > 0)
    .map((a) => ({
      id: `mnt_${a.id}`,
      name: a.name,
      amount: a.maintenanceCostMonthly,
      frequency: "MONTHLY" as const,
      startYear: null,
      endYear: null,
    }));
  const reserve = envelopeReserveBudgetLine(
    input.expenses,
    input.budgetCategories ?? [],
  );
  return {
    budgetIncomes,
    budgetExpenses: [
      ...toBudgetLines(input.expenses),
      ...(reserve ? toBudgetLines([reserve]) : []),
      ...debtLines,
      ...maintenanceLines,
    ],
  };
}
