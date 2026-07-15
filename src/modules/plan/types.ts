import type { PlanFrequency } from "./frequency";

export interface PlanInput {
  userId: string;
  horizonMonths: number;
  baseInflationPct: number;
  incomeTaxPct: number;
  assets: Array<{
    id: string;
    name: string;
    type: string;
    currentValue: number;
    expectedReturnPct: number;
    volatilityPct: number;
    maintenanceCostMonthly: number;
    dividendIncomeMonthly: number;
    liquidityDays: number;
  }>;
  liabilities: Array<{
    remainingBalance: number;
    monthlyPayment: number;
    interestRatePct: number;
  }>;
  incomes: Array<{
    amount: number;
    frequency: PlanFrequency;
    taxRatePct: number;
    growthRatePct: number;
  }>;
  expenses: Array<{
    amount: number;
    frequency: PlanFrequency;
    growthRatePct: number;
    isEssential: boolean;
  }>;
  goals: Array<{
    id: string;
    name: string;
    targetAmountNominal: number;
    targetMonthIndex: number;
    priority: number;
    allowPartialFunding: boolean;
    minAmount: number | null;
    maxAmount: number | null;
    stages: Array<{
      id: string;
      label: string;
      amount: number;
      monthIndex: number;
    }>;
  }>;
  scenarioModifiers?: ScenarioModifiers;
}

export type GoalFundingStageResult = {
  id: string;
  label: string;
  monthIndex: number;
  amountInflated: number;
  requiredMonthly: number;
  funded: boolean;
};

export type GoalFundingResult = {
  goalId: string;
  priority: number;
  monthsToGoal: number;
  minAmount: number;
  desiredAmount: number;
  maxAmount: number;
  inflationAdjustedMin: number;
  inflationAdjustedDesired: number;
  inflationAdjustedMax: number;
  projectedBalanceAtTarget: number;
  reservedByHigherPriority: number;
  availableAtTarget: number;
  requiredMonthlySaving: number;
  requiredMonthlyMin: number;
  requiredMonthlyDesired: number;
  requiredMonthlyMax: number;
  allocatedMonthlySaving: number;
  achievability: "max" | "desired" | "min" | "none";
  stages: GoalFundingStageResult[];
};

export interface ScenarioModifiers {
  returnMultiplier?: number;
  inflationMultiplier?: number;
  /** Additive inflation shift in percentage points (e.g. +2 → inflation += 2%) */
  inflationDeltaPct?: number;
  assetShockPct?: number;
  incomeLossMonths?: number;
  expenseCutPct?: number;
  /** Scale asset dividend/rental income (1 = unchanged, 0 = stop) */
  dividendMultiplier?: number;
  /** @deprecated use assetSales */
  assetSale?: ScenarioAssetSale;
  assetSales?: ScenarioAssetSale[];
  assetPurchases?: ScenarioAssetPurchase[];
}

export interface ScenarioAssetSale {
  assetId: string;
  monthIndex: number;
  /** Net proceeds after tax/fees */
  proceeds: number;
}

export interface ScenarioAssetPurchase {
  monthIndex: number;
  amount: number;
  name: string;
  expectedReturnPct: number;
  dividendIncomeMonthly: number;
}

export interface MonthlyProjection {
  month: number;
  netWorth: number;
  cashflow: number;
  income: number;
  expenses: number;
  debtPayments: number;
  investmentReturn: number;
}

export interface DeterministicPlanResult {
  monthly: MonthlyProjection[];
  goalFunding: GoalFundingResult[];
  summary: {
    finalNetWorth: number;
    avgMonthlySurplus: number;
    recommendedMonthlySaving: number;
  };
}
