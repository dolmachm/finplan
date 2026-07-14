export type IPlanStreamFrequency = "MONTHLY" | "QUARTERLY" | "YEARLY" | "PERIOD";
export type IPlanDistribution = "RISK_FREE" | "NORMAL" | "LOGNORMAL";
export type IPlanAxisMode = "INDEX" | "YEAR" | "AGE";

export type IPlanStream = {
  id: string;
  name: string;
  amount: number;
  frequency: IPlanStreamFrequency;
  startYear: number;
  endYear: number;
  enabled: boolean;
  linkedEntityId: string | null;
};

export type IPlanReturnStep = {
  fromYear: number | null;
  ratePct: number;
  /** Annual St.D. % — as in Spirin MC iPlan */
  volatilityPct: number;
};

export type IPlanVariant = {
  id: string;
  name: string;
  startYear: number;
  horizonYears: number;
  /** Investor age at startYear */
  age: number;
  includeInitialCapital: boolean;
  distribution: IPlanDistribution;
  axisMode: IPlanAxisMode;
  percentileLow: number;
  percentileHigh: number;
  mcRuns: number;
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
  age: number;
  yearsElapsed: number;
  ratePct: number;
  volatilityPct: number;
  startCapital: number;
  growth: number;
  incomeAnnual: number;
  expenseAnnual: number;
  surplusAnnual: number;
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

export type IPlanMcYear = {
  year: number;
  age: number;
  median: number;
  pLow: number;
  pHigh: number;
  successCount: number;
  failCount: number;
};

export type IPlanMcResult = {
  years: IPlanMcYear[];
  finalSuccessRate: number;
  finalMedian: number;
  finalPLow: number;
  finalPHigh: number;
};
