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
  }>;
  scenarioModifiers?: ScenarioModifiers;
}

export interface ScenarioModifiers {
  returnMultiplier?: number;
  inflationMultiplier?: number;
  assetShockPct?: number;
  incomeLossMonths?: number;
  expenseCutPct?: number;
  assetSale?: { assetId: string; monthIndex: number; proceeds: number };
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
  goalFunding: Array<{
    goalId: string;
    requiredMonthlySaving: number;
    projectedBalanceAtTarget: number;
    inflationAdjustedTarget: number;
  }>;
  summary: {
    finalNetWorth: number;
    avgMonthlySurplus: number;
    recommendedMonthlySaving: number;
  };
}
