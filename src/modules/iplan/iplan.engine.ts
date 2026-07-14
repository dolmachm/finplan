import type {
  IPlanDistribution,
  IPlanMcResult,
  IPlanMcYear,
  IPlanProjection,
  IPlanReturnStep,
  IPlanStream,
  IPlanStreamFrequency,
  IPlanVariant,
  IPlanYearRow,
} from "./types";
import { budgetForYear, type BudgetLine } from "./budget";

export type { BudgetLine };

/** Excel CHOOSE → annual cashflow */
export function annualAmount(
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

export function periodYears(startYear: number, endYear: number): number {
  if (!startYear || !endYear) return 0;
  const n = endYear - startYear + 1;
  return n >= 0 && n <= 199 ? n : 0;
}

function pickScheduleStep(
  year: number,
  schedule: IPlanReturnStep[],
): IPlanReturnStep | null {
  const sorted = [...schedule]
    .filter((s) => s.fromYear != null && s.fromYear > 0)
    .sort((a, b) => (b.fromYear ?? 0) - (a.fromYear ?? 0));
  for (const step of sorted) {
    if (year >= (step.fromYear ?? 0) && (step.ratePct !== 0 || step.volatilityPct !== 0)) {
      return step;
    }
  }
  return schedule.find((s) => s.fromYear == null || s.fromYear === 0) ?? null;
}

export function rateForYear(
  year: number,
  schedule: IPlanReturnStep[],
  fallback = 0,
): number {
  return pickScheduleStep(year, schedule)?.ratePct ?? fallback;
}

export function volatilityForYear(
  year: number,
  schedule: IPlanReturnStep[],
  fallback = 0,
): number {
  return pickScheduleStep(year, schedule)?.volatilityPct ?? fallback;
}

export function streamAnnualInYear(stream: IPlanStream, year: number): number {
  if (!stream.enabled) return 0;
  const years = periodYears(stream.startYear, stream.endYear);
  if (years === 0) return 0;
  if (year < stream.startYear || year > stream.endYear) return 0;
  return annualAmount(stream.amount, stream.frequency, years);
}

export function cashflowsForYear(
  variant: IPlanVariant,
  year: number,
  budget?: { surplusAnnual: number } | null,
): { contributions: number; goals: number; surplusAnnual: number } {
  const scheduled = variant.contributions.reduce(
    (sum, s) => sum + streamAnnualInYear(s, year),
    0,
  );
  const surplusAnnual = budget?.surplusAnnual ?? Number.POSITIVE_INFINITY;
  // Cap at budget surplus (доходы − расходы); never invest more than available
  const contributions =
    surplusAnnual === Number.POSITIVE_INFINITY
      ? scheduled
      : Math.min(scheduled, Math.max(0, surplusAnnual));
  const goals = -variant.goals.reduce(
    (sum, s) => sum + streamAnnualInYear(s, year),
    0,
  );
  return {
    contributions,
    goals,
    surplusAnnual:
      surplusAnnual === Number.POSITIVE_INFINITY ? 0 : surplusAnnual,
  };
}

export function weightedReturnPct(
  assets: Array<{ currentValue: number; expectedReturnPct: number }>,
): number {
  const total = assets.reduce((s, a) => s + a.currentValue, 0);
  if (total <= 0) return 0;
  return assets.reduce(
    (s, a) => s + (a.currentValue / total) * a.expectedReturnPct,
    0,
  );
}

export function weightedVolatilityPct(
  assets: Array<{ currentValue: number; volatilityPct: number }>,
): number {
  const total = assets.reduce((s, a) => s + a.currentValue, 0);
  if (total <= 0) return 15;
  return assets.reduce(
    (s, a) => s + (a.currentValue / total) * a.volatilityPct,
    0,
  );
}

/** Back-compat for plans saved before MC fields */
export function normalizeVariant(v: IPlanVariant): IPlanVariant {
  return {
    ...v,
    age: v.age ?? 40,
    distribution: v.distribution ?? "LOGNORMAL",
    axisMode: v.axisMode ?? "YEAR",
    percentileLow: v.percentileLow ?? 10,
    percentileHigh: v.percentileHigh ?? 90,
    mcRuns: Math.min(2000, Math.max(50, v.mcRuns ?? 500)),
    returnSchedule: (v.returnSchedule ?? []).map((s) => ({
      fromYear: s.fromYear,
      ratePct: s.ratePct ?? 0,
      volatilityPct: s.volatilityPct ?? 15,
    })),
    contributions: v.contributions ?? [],
    goals: v.goals ?? [],
  };
}

function randn(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Excel: RISK_FREE | NORMINV | LOGNORM-style */
export function sampleReturnPct(
  meanPct: number,
  volPct: number,
  distribution: IPlanDistribution,
): number {
  if (distribution === "RISK_FREE" || volPct === 0) return meanPct;
  if (distribution === "NORMAL") {
    return meanPct + randn() * volPct;
  }
  // LOGNORMAL: (EXP(NORMINV(RAND(), mean/100, vol/100)) - 1) * 100
  return (Math.exp(meanPct / 100 + randn() * (volPct / 100)) - 1) * 100;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * p)),
  );
  return sorted[idx] ?? 0;
}

export function runIPlanProjection(
  variantInput: IPlanVariant,
  initialCapital: number,
  incomes: BudgetLine[] = [],
  expenses: BudgetLine[] = [],
): IPlanProjection {
  const variant = normalizeVariant(variantInput);
  const rows: IPlanYearRow[] = [];
  let capital = variant.includeInitialCapital ? initialCapital : 0;
  const horizon = Math.min(Math.max(1, variant.horizonYears), 100);
  const hasBudget = incomes.length > 0 || expenses.length > 0;

  for (let i = 0; i < horizon; i++) {
    const year = variant.startYear + i;
    const ratePct = rateForYear(year, variant.returnSchedule);
    const vol = volatilityForYear(year, variant.returnSchedule);
    const startCapital = capital;
    const growth = (startCapital * ratePct) / 100;
    const budget = hasBudget ? budgetForYear(year, incomes, expenses) : null;
    const { contributions, goals, surplusAnnual } = cashflowsForYear(
      variant,
      year,
      budget,
    );
    const endCapital = startCapital + growth + contributions + goals;
    capital = endCapital;

    rows.push({
      index: i + 1,
      year,
      age: variant.age + i,
      yearsElapsed: i,
      ratePct,
      volatilityPct: vol,
      startCapital,
      growth,
      incomeAnnual: budget?.incomeAnnual ?? 0,
      expenseAnnual: budget?.expenseAnnual ?? 0,
      surplusAnnual: budget?.surplusAnnual ?? surplusAnnual,
      contributionsTotal: contributions,
      goalsTotal: goals,
      endCapital,
      contributionFlags: variant.contributions.map(
        (s) => streamAnnualInYear(s, year) !== 0,
      ),
      goalFlags: variant.goals.map((s) => streamAnnualInYear(s, year) !== 0),
    });
  }

  return {
    variantId: variant.id,
    variantName: variant.name,
    initialCapital,
    weightedReturnPct: rateForYear(variant.startYear, variant.returnSchedule),
    rows,
    finalCapital: rows[rows.length - 1]?.endCapital ?? capital,
  };
}

/**
 * Yearly Monte Carlo as in Spirin sheet:
 * each run samples annual return, end = start + start*r/100 + resources + goals
 */
export function runIPlanMonteCarlo(
  variantInput: IPlanVariant,
  initialCapital: number,
  incomes: BudgetLine[] = [],
  expenses: BudgetLine[] = [],
): IPlanMcResult {
  const variant = normalizeVariant(variantInput);
  const horizon = Math.min(Math.max(1, variant.horizonYears), 100);
  const runs = variant.mcRuns;
  const paths: number[][] = Array.from({ length: horizon }, () => []);
  const hasBudget = incomes.length > 0 || expenses.length > 0;

  for (let run = 0; run < runs; run++) {
    let capital = variant.includeInitialCapital ? initialCapital : 0;
    for (let i = 0; i < horizon; i++) {
      const year = variant.startYear + i;
      const mean = rateForYear(year, variant.returnSchedule);
      const vol = volatilityForYear(year, variant.returnSchedule);
      const r = sampleReturnPct(mean, vol, variant.distribution);
      const budget = hasBudget ? budgetForYear(year, incomes, expenses) : null;
      const { contributions, goals } = cashflowsForYear(variant, year, budget);
      capital = capital + (capital * r) / 100 + contributions + goals;
      paths[i]!.push(capital);
    }
  }

  const years: IPlanMcYear[] = [];
  for (let i = 0; i < horizon; i++) {
    const sorted = [...paths[i]!].sort((a, b) => a - b);
    const successCount = sorted.filter((x) => x > 0).length;
    years.push({
      year: variant.startYear + i,
      age: variant.age + i,
      median: percentile(sorted, 0.5),
      pLow: percentile(sorted, variant.percentileLow / 100),
      pHigh: percentile(sorted, variant.percentileHigh / 100),
      successCount,
      failCount: runs - successCount,
    });
  }

  const last = years[years.length - 1]!;
  return {
    years,
    finalSuccessRate: last.successCount / runs,
    finalMedian: last.median,
    finalPLow: last.pLow,
    finalPHigh: last.pHigh,
  };
}
