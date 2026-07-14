export type IPlanStreamFrequency = "MONTHLY" | "QUARTERLY" | "YEARLY" | "PERIOD";

export type IPlanStream = {
  id: string;
  name: string;
  amount: number;
  frequency: IPlanStreamFrequency;
  startYear: number;
  endYear: number;
  enabled: boolean;
  /** Optional link to Income (contributions) or Goal (withdrawals) */
  linkedEntityId: string | null;
};

export type IPlanReturnStep = {
  fromYear: number | null;
  ratePct: number;
};

export type IPlanVariant = {
  id: string;
  name: string;
  startYear: number;
  horizonYears: number;
  includeInitialCapital: boolean;
  returnSchedule: IPlanReturnStep[];
  contributions: IPlanStream[];
  goals: IPlanStream[];
};

export type InvestmentPlan = {
  id: string;
  userId: string;
  activeVariantId: string;
  variants: IPlanVariant[];
  createdAt: Date;
  updatedAt: Date;
};

export type IPlanYearRow = {
  index: number;
  year: number;
  yearsElapsed: number;
  ratePct: number;
  startCapital: number;
  growth: number;
  contributionsTotal: number;
  goalsTotal: number;
  endCapital: number;
  contributionFlags: boolean[];
  goalFlags: boolean[];
};

export type IPlanProjection = {
  variantId: string;
  variantName: string;
  initialCapital: number;
  weightedReturnPct: number;
  rows: IPlanYearRow[];
  finalCapital: number;
};
