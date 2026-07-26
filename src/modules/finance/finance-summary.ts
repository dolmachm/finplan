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

/** Счётчики для прогресса заполнения без передачи списков сущностей. */
export type FinanceSummaryCounts = {
  assets: number;
  liabilities: number;
  incomes: number;
  expenses: number;
  goals: number;
  scenarios: number;
};

/**
 * Лёгкий ответ для первого paint Home: готовые цифры и скор.
 * Без массивов assets/incomes/… — меньше JSON и быстрее TTI.
 * Redis на сервере всё равно читается один batch (через snapshot).
 */
export type FinanceSummary = {
  metrics: DashboardMetrics;
  score: FinancialScore;
  corridor: SavingsCorridor | null;
  counts: FinanceSummaryCounts;
  scenarioCount: number;
};

/**
 * Считает summary из уже загруженного snapshot (клиент после CRUD
 * или сервер после loadUserFinanceSnapshot).
 */
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

/** Загрузка snapshot + агрегация в summary для GET /api/finance/summary. */
export async function loadUserFinanceSummary(
  userId: string,
): Promise<FinanceSummary> {
  const snap = await loadUserFinanceSnapshot(userId);
  return buildFinanceSummaryFromSnapshot(snap);
}
