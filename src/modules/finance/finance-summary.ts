import { buildSavingsCorridor, type SavingsCorridor } from "@/modules/budget/savings-corridor";
import {
  computeDashboardMetrics,
  type DashboardMetrics,
  type HomeDashboardInput,
} from "@/modules/dashboard/insights";
import {
  scoreFromHomeInput,
  type FinancialScore,
} from "@/modules/dashboard/scoring";
import {
  loadUserFinanceSnapshot,
  type FinanceSnapshot,
} from "@/modules/finance/finance-snapshot";

export type FinanceSummaryCounts = {
  assets: number;
  liabilities: number;
  incomes: number;
  expenses: number;
  goals: number;
  scenarios: number;
};

export type FinanceSummary = {
  metrics: DashboardMetrics;
  score: FinancialScore;
  corridor: SavingsCorridor | null;
  counts: FinanceSummaryCounts;
  scenarioCount: number;
};

export function buildFinanceSummaryFromSnapshot(
  snap: FinanceSnapshot,
  extras?: {
    recommendedMonthlySaving?: number;
    goalProbabilities?: Array<{ probability: number }>;
    projectionCashflowAvg?: number | null;
  },
): FinanceSummary {
  const input: HomeDashboardInput = {
    assets: snap.assets,
    liabilities: snap.liabilities,
    incomes: snap.incomes,
    expenses: snap.expenses,
    goals: snap.goals,
    scenarioCount: snap.scenarios.length,
    budgetCategories: snap.budgetCategories,
    recommendedMonthlySaving: extras?.recommendedMonthlySaving,
    goalProbabilities: extras?.goalProbabilities,
  };
  const metrics = computeDashboardMetrics(input);
  const score = scoreFromHomeInput(input, {
    projectionCashflowAvg: extras?.projectionCashflowAvg,
  });
  const corridor = buildSavingsCorridor({
    incomes: snap.incomes,
    expenses: snap.expenses,
    budgetCategories: snap.budgetCategories,
  });
  return {
    metrics,
    score,
    corridor,
    counts: {
      assets: snap.assets.length,
      liabilities: snap.liabilities.length,
      incomes: snap.incomes.length,
      expenses: snap.expenses.length,
      goals: snap.goals.length,
      scenarios: snap.scenarios.length,
    },
    scenarioCount: snap.scenarios.length,
  };
}

export async function loadUserFinanceSummary(
  userId: string,
): Promise<FinanceSummary> {
  const snap = await loadUserFinanceSnapshot(userId);
  return buildFinanceSummaryFromSnapshot(snap);
}
