import type { GoalFundingResult } from "@/modules/plan/types";

export type PlanProjectionSummary = {
  finalNetWorth: number;
  avgMonthlySurplus: number;
  recommendedMonthlySaving: number;
};

export type PlanProjectionResult = {
  monthly: Array<{ month: number; netWorth: number; cashflow: number }>;
  goalFunding: GoalFundingResult[];
  summary: PlanProjectionSummary;
};

export type PlanProjection = {
  result: PlanProjectionResult;
  scenario: string;
  scenarioId: string | null;
  isActive: boolean;
};
