import { buildSavingsCorridor, type SavingsCorridor } from "@/modules/budget/savings-corridor";
import {
  envelopeMonthStatuses,
  transactionsInMonth,
} from "@/modules/budget/budget-summary";
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
import { prisma } from "@/shared/db";
import type { CashTransaction } from "@/shared/types";

/** Счётчики для прогресса заполнения без передачи списков сущностей. */
export type FinanceSummaryCounts = {
  assets: number;
  liabilities: number;
  incomes: number;
  expenses: number;
  goals: number;
  scenarios: number;
};

export type MonthActualsSnippet = {
  year: number;
  month: number;
  income: number;
  expense: number;
  delta: number;
  txCount: number;
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
  monthActuals: MonthActualsSnippet | null;
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
    monthTxs?: CashTransaction[];
    /** Сохранить факт при локальном пересчёте без txs */
    previousMonthActuals?: MonthActualsSnippet | null;
    previousActualByCategory?: Map<string, number>;
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
    liabilities: snap.liabilities,
    assets: snap.assets,
  });

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthTxs = extras?.monthTxs
    ? transactionsInMonth(extras.monthTxs, year, month)
    : [];

  let monthActuals: MonthActualsSnippet | null =
    extras?.previousMonthActuals ?? null;

  if (extras?.monthTxs) {
    let income = 0;
    let expense = 0;
    for (const t of monthTxs) {
      if (t.kind === "income") income += t.amount;
      else expense += t.amount;
    }
    monthActuals = {
      year,
      month,
      income,
      expense,
      delta: income - expense,
      txCount: monthTxs.length,
    };

    const monthStatuses = envelopeMonthStatuses(
      snap.expenses,
      snap.budgetCategories,
      monthTxs,
    );
    metrics.envelopes = monthStatuses;
    metrics.envelopeOverspentCount = monthStatuses.filter(
      (s) => s.overspentActual || s.overspent,
    ).length;
    metrics.envelopeOverspent = monthStatuses
      .filter(
        (s) =>
          (s.overspentActual || s.overspent) && s.monthlyLimit != null,
      )
      .map((s) => ({
        name: s.name,
        plannedMonthly: s.actualMonthly,
        monthlyLimit: s.monthlyLimit as number,
      }));
  } else if (extras?.previousActualByCategory?.size) {
    metrics.envelopes = metrics.envelopes.map((s) => {
      const actualMonthly =
        extras.previousActualByCategory!.get(s.categoryId) ?? 0;
      const remainingVsLimit =
        s.monthlyLimit != null ? s.monthlyLimit - actualMonthly : null;
      return {
        ...s,
        actualMonthly,
        remaining: remainingVsLimit ?? s.remaining,
        overspent:
          remainingVsLimit != null
            ? remainingVsLimit < -0.01
            : s.overspent,
      };
    });
    metrics.envelopeOverspentCount = metrics.envelopes.filter(
      (s) => s.overspent,
    ).length;
  }

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
    monthActuals,
  };
}

/** Загрузка snapshot + агрегация в summary для GET /api/finance/summary. */
export async function loadUserFinanceSummary(
  userId: string,
): Promise<FinanceSummary> {
  const [snap, txs] = await Promise.all([
    loadUserFinanceSnapshot(userId),
    prisma.cashTransaction.findMany({ where: { userId } }),
  ]);
  return buildFinanceSummaryFromSnapshot(snap, {
    monthTxs: txs as CashTransaction[],
  });
}
