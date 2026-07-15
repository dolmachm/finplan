import {
  buildInsights,
  computeDashboardMetrics,
  type DashboardInsight,
  type DashboardMetrics,
} from "@/modules/dashboard/insights";
import type { DeterministicPlanResult } from "@/modules/plan/types";
import type { Asset, Expense, Goal, Income, Liability } from "@/shared/types";
import {
  isItemEnabled,
  type ReportConfig,
} from "./report-config";

export type PdfNamedAmount = { name: string; amount: number };

export type PdfGoalRow = {
  name: string;
  target: number;
  achievability?: string;
  requiredMonthly?: number;
  allocatedMonthly?: number;
  probability?: number;
};

export type PdfReportData = {
  config: ReportConfig;
  userName: string;
  generatedAt: string;
  metrics: Pick<
    DashboardMetrics,
    | "netWorth"
    | "surplusMonthly"
    | "cushionMonths"
    | "kdr"
    | "recommendedMonthlySaving"
    | "assetsTotal"
    | "liabilitiesTotal"
    | "incomeMonthly"
    | "expenseMonthly"
  >;
  assets: PdfNamedAmount[];
  liabilities: PdfNamedAmount[];
  assumptions: {
    inflation: number;
    horizonYears: number;
    incomeTaxPct: number;
  };
  goals: PdfGoalRow[];
  summary: {
    finalNetWorth: number;
    avgMonthlySurplus: number;
    recommendedSaving: number;
  };
  /** Yearly (or sampled) net-worth points for chart */
  nwSeries: Array<{ label: string; value: number }>;
  insights: Array<{ title: string; body: string }>;
  recommendations: Array<{ title: string; body: string }>;
};

const ACHIEVABILITY_LABEL: Record<string, string> = {
  max: "макс.",
  desired: "желаемая",
  min: "мин.",
  none: "недостижима",
};

type BuildInput = {
  config: ReportConfig;
  userName: string;
  assets: Asset[];
  liabilities: Liability[];
  incomes: Income[];
  expenses: Expense[];
  goals: Goal[];
  scenarioCount: number;
  macro: {
    baseInflationPct: number;
    planHorizonYears: number;
    incomeTaxPct: number;
  };
  det: DeterministicPlanResult;
  goalProbabilities: Array<{ goalId: string; probability: number }>;
};

function sampleNwSeries(
  monthly: DeterministicPlanResult["monthly"],
  horizonYears: number,
): Array<{ label: string; value: number }> {
  if (monthly.length === 0) return [];
  const points: Array<{ label: string; value: number }> = [];
  const step = Math.max(1, Math.floor(monthly.length / Math.min(horizonYears, 20)));
  for (let i = 0; i < monthly.length; i += step) {
    const m = monthly[i]!;
    const year = Math.floor(m.month / 12);
    points.push({ label: `Г${year}`, value: m.netWorth });
  }
  const last = monthly[monthly.length - 1]!;
  if (points.length === 0 || points[points.length - 1]!.value !== last.netWorth) {
    points.push({
      label: `Г${Math.floor(last.month / 12)}`,
      value: last.netWorth,
    });
  }
  return points;
}

function mapInsights(
  all: DashboardInsight[],
  kind: "insight" | "recommendation",
  limit = 6,
): Array<{ title: string; body: string }> {
  return all
    .filter((i) => i.kind === kind)
    .slice(0, limit)
    .map((i) => ({ title: i.title, body: i.body }));
}

export function buildReportPayload(input: BuildInput): PdfReportData {
  const { config, det, goals, goalProbabilities, macro } = input;

  const metrics = computeDashboardMetrics({
    assets: input.assets,
    liabilities: input.liabilities,
    incomes: input.incomes,
    expenses: input.expenses,
    goals,
    scenarioCount: input.scenarioCount,
    recommendedMonthlySaving: det.summary.recommendedMonthlySaving,
    goalProbabilities: goalProbabilities.map((p) => ({
      probability: p.probability,
    })),
  });

  const allInsights = buildInsights(metrics);
  const fundingByGoal = new Map(
    det.goalFunding.map((f) => [f.goalId, f] as const),
  );

  const goalRows: PdfGoalRow[] = goals.map((g) => {
    const fund = fundingByGoal.get(g.id);
    const prob = goalProbabilities.find((p) => p.goalId === g.id);
    return {
      name: g.name,
      target: g.targetAmountNominal,
      achievability: fund
        ? ACHIEVABILITY_LABEL[fund.achievability] ?? fund.achievability
        : undefined,
      requiredMonthly: fund?.requiredMonthlyDesired,
      allocatedMonthly: fund?.allocatedMonthlySaving,
      probability: prob?.probability,
    };
  });

  return {
    config,
    userName: input.userName,
    generatedAt: new Date().toLocaleString("ru-RU"),
    metrics: {
      netWorth: metrics.netWorth,
      surplusMonthly: metrics.surplusMonthly,
      cushionMonths: metrics.cushionMonths,
      kdr: metrics.kdr,
      recommendedMonthlySaving: metrics.recommendedMonthlySaving,
      assetsTotal: metrics.assetsTotal,
      liabilitiesTotal: metrics.liabilitiesTotal,
      incomeMonthly: metrics.incomeMonthly,
      expenseMonthly: metrics.expenseMonthly,
    },
    assets: input.assets.map((a) => ({
      name: a.name,
      amount: a.currentValue,
    })),
    liabilities: input.liabilities.map((l) => ({
      name: l.name,
      amount: l.remainingBalance,
    })),
    assumptions: {
      inflation: macro.baseInflationPct,
      horizonYears: macro.planHorizonYears,
      incomeTaxPct: macro.incomeTaxPct,
    },
    goals: goalRows,
    summary: {
      finalNetWorth: det.summary.finalNetWorth,
      avgMonthlySurplus: det.summary.avgMonthlySurplus,
      recommendedSaving: det.summary.recommendedMonthlySaving,
    },
    nwSeries: isItemEnabled(config, "projection", "proj_chart")
      ? sampleNwSeries(det.monthly, macro.planHorizonYears)
      : [],
    insights: isItemEnabled(config, "insights", "insights_list")
      ? mapInsights(allInsights, "insight")
      : [],
    recommendations: isItemEnabled(config, "recommendations", "recs_list")
      ? mapInsights(allInsights, "recommendation")
      : [],
  };
}
