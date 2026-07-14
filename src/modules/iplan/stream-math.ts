import type { IPlanStreamFrequency } from "./types";

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
