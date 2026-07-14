import type {
  IPlanProjection,
  IPlanReturnStep,
  IPlanStream,
  IPlanStreamFrequency,
  IPlanVariant,
  IPlanYearRow,
} from "./types";

/** Excel CHOOSE(I, 0, C*12, C*4, C, C/years) → annual cashflow */
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

export function rateForYear(
  year: number,
  schedule: IPlanReturnStep[],
  fallback = 0,
): number {
  const sorted = [...schedule]
    .filter((s) => s.fromYear == null || s.fromYear > 0)
    .sort((a, b) => (b.fromYear ?? 0) - (a.fromYear ?? 0));
  for (const step of sorted) {
    if (step.fromYear == null || step.fromYear === 0) continue;
    if (year >= step.fromYear && step.ratePct !== 0) return step.ratePct;
  }
  const base = schedule.find((s) => s.fromYear == null || s.fromYear === 0);
  return base?.ratePct ?? fallback;
}

function streamAnnualInYear(stream: IPlanStream, year: number): number {
  if (!stream.enabled) return 0;
  const years = periodYears(stream.startYear, stream.endYear);
  if (years === 0) return 0;
  if (year < stream.startYear || year > stream.endYear) return 0;
  return annualAmount(stream.amount, stream.frequency, years);
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

export function runIPlanProjection(
  variant: IPlanVariant,
  initialCapital: number,
): IPlanProjection {
  const rows: IPlanYearRow[] = [];
  let capital = variant.includeInitialCapital ? initialCapital : 0;
  const horizon = Math.min(Math.max(1, variant.horizonYears), 100);

  for (let i = 0; i < horizon; i++) {
    const year = variant.startYear + i;
    const ratePct = rateForYear(year, variant.returnSchedule);
    const startCapital = capital;
    const growth = (startCapital * ratePct) / 100;

    const contributionFlags = variant.contributions.map(
      (s) => streamAnnualInYear(s, year) !== 0,
    );
    const goalFlags = variant.goals.map((s) => streamAnnualInYear(s, year) !== 0);

    const contributionsTotal = variant.contributions.reduce(
      (sum, s) => sum + streamAnnualInYear(s, year),
      0,
    );
    // goals are withdrawals → negative in Excel
    const goalsTotal = -variant.goals.reduce(
      (sum, s) => sum + streamAnnualInYear(s, year),
      0,
    );

    const endCapital = startCapital + growth + contributionsTotal + goalsTotal;
    capital = endCapital;

    rows.push({
      index: i + 1,
      year,
      yearsElapsed: i,
      ratePct,
      startCapital,
      growth,
      contributionsTotal,
      goalsTotal,
      endCapital,
      contributionFlags,
      goalFlags,
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
