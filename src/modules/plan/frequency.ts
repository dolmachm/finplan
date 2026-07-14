export const FREQUENCY_VALUES = [
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "YEARLY",
  "ONE_TIME",
] as const;

export type PlanFrequency = (typeof FREQUENCY_VALUES)[number];

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
