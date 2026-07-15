import type { PlanInput } from "@/modules/plan/types";
import { runDeterministicPlan } from "@/modules/plan/cashflow.engine";
import { percentile, randn } from "@/shared/math";

function cholesky2x2(corr: number): number[][] {
  const a11 = 1;
  const a21 = corr;
  const a22 = Math.sqrt(Math.max(1e-8, 1 - corr * corr));
  return [
    [a11, 0],
    [a21, a22],
  ];
}

export interface MonteCarloParams {
  numRuns: number;
  horizonMonths: number;
  correlation?: number;
  crisisShockPct?: number;
}

export interface GoalMonteCarloResult {
  goalId: string;
  probability: number;
  median: number;
  p5: number;
  p95: number;
}

export interface MonteCarloResult {
  goalResults: GoalMonteCarloResult[];
  wealthAtHorizon: { p5: number; median: number; p95: number };
  samplePaths: Array<{ label: string; netWorth: number[] }>;
  progress: number;
}

export function runMonteCarlo(
  baseInput: PlanInput,
  params: MonteCarloParams,
  onProgress?: (pct: number) => void,
): MonteCarloResult {
  const { numRuns, horizonMonths, correlation = 0.3, crisisShockPct } =
    params;
  const chol = cholesky2x2(correlation);

  const finalWealth: number[] = [];
  const goalHits: Record<string, number[]> = {};

  for (const g of baseInput.goals) {
    goalHits[g.id] = [];
  }

  const sampleWorst: number[] = [];
  const sampleMedian: number[] = [];
  const sampleBest: number[] = [];

  for (let run = 0; run < numRuns; run++) {
    const shocks = Array.from({ length: horizonMonths }, () => {
      const z1 = randn();
      const z2 = randn();
      const r1 = chol[0][0] * z1;
      const r2 = chol[1][0] * z1 + chol[1][1] * z2;
      return { r1, r2 };
    });

    const applyCrisis = crisisShockPct && run < numRuns * 0.15;
    const perturbedAssets = baseInput.assets.map((a, i) => {
      const monthlyVol = (a.volatilityPct / 100) / Math.sqrt(12);
      let totalReturn = a.expectedReturnPct;
      for (let m = 0; m < horizonMonths; m++) {
        const shock = i % 2 === 0 ? shocks[m].r1 : shocks[m].r2;
        totalReturn += shock * monthlyVol * 100;
      }
      const avgMonthly =
        Math.pow(1 + totalReturn / 100 / horizonMonths, 1) - 1;
      let currentValue = a.currentValue;
      if (applyCrisis) {
        currentValue *= 1 + crisisShockPct / 100;
      }
      return {
        ...a,
        expectedReturnPct: (Math.pow(1 + avgMonthly, 12) - 1) * 100,
        currentValue,
      };
    });

    const planResult = runDeterministicPlan({
      ...baseInput,
      horizonMonths,
      assets: perturbedAssets,
    });

    const nw = planResult.monthly.map((x) => x.netWorth);
    const final = nw[nw.length - 1] ?? 0;
    finalWealth.push(final);

    for (const g of baseInput.goals) {
      const idx = Math.min(g.targetMonthIndex, nw.length - 1);
      const atGoal = nw[idx] ?? 0;
      const inflatedTarget =
        g.targetAmountNominal *
        Math.pow(1 + baseInput.baseInflationPct / 100, g.targetMonthIndex / 12);
      const minShare =
        g.minAmount != null && g.targetAmountNominal > 0
          ? g.minAmount / g.targetAmountNominal
          : g.allowPartialFunding
            ? 0.8
            : 1;
      const threshold = Math.min(1, Math.max(0.5, minShare));
      goalHits[g.id].push(atGoal >= inflatedTarget * threshold ? 1 : 0);
    }

    if (run === 0) {
      sampleWorst.push(...nw);
      sampleMedian.push(...nw);
      sampleBest.push(...nw);
    } else {
      const f = final;
      if (f < (sampleWorst[sampleWorst.length - 1] ?? Infinity)) {
        sampleWorst.splice(0, sampleWorst.length, ...nw);
      }
      if (f > (sampleBest[sampleBest.length - 1] ?? -Infinity)) {
        sampleBest.splice(0, sampleBest.length, ...nw);
      }
    }

    if (run % 100 === 0 && onProgress) {
      onProgress(Math.round((run / numRuns) * 100));
    }
  }

  finalWealth.sort((a, b) => a - b);

  const goalResults: GoalMonteCarloResult[] = baseInput.goals.map((g) => {
    const hits = goalHits[g.id];
    const balances = hits.map((h, i) => (h ? finalWealth[i] : 0));
    balances.sort((a, b) => a - b);
    const prob = hits.reduce((s, h) => s + h, 0) / numRuns;
    return {
      goalId: g.id,
      probability: prob,
      median: percentile(finalWealth, 0.5),
      p5: percentile(finalWealth, 0.05),
      p95: percentile(finalWealth, 0.95),
    };
  });

  onProgress?.(100);

  return {
    goalResults,
    wealthAtHorizon: {
      p5: percentile(finalWealth, 0.05),
      median: percentile(finalWealth, 0.5),
      p95: percentile(finalWealth, 0.95),
    },
    samplePaths: [
      { label: "worst", netWorth: sampleWorst },
      { label: "median", netWorth: sampleMedian },
      { label: "best", netWorth: sampleBest },
    ],
    progress: 100,
  };
}

export function runSensitivity(
  baseInput: PlanInput,
  runs: number = 500,
): Record<string, GoalMonteCarloResult[]> {
  const deltas = [
    { key: "inflation+1", inflation: 1 },
    { key: "inflation-1", inflation: -1 },
    { key: "return+1", returnDelta: 1 },
    { key: "return-1", returnDelta: -1 },
    { key: "expenses-10pct", expenseCut: 10 },
  ];
  const out: Record<string, GoalMonteCarloResult[]> = {};

  for (const d of deltas) {
    const modified: PlanInput = {
      ...baseInput,
      baseInflationPct: baseInput.baseInflationPct + (d.inflation ?? 0),
      assets: baseInput.assets.map((a) => ({
        ...a,
        expectedReturnPct: a.expectedReturnPct + (d.returnDelta ?? 0),
      })),
      expenses: baseInput.expenses.map((e) => ({
        ...e,
        amount: e.amount * (1 - (d.expenseCut ?? 0) / 100),
      })),
    };
    const mc = runMonteCarlo(modified, {
      numRuns: runs,
      horizonMonths: baseInput.horizonMonths,
    });
    out[d.key] = mc.goalResults;
  }
  return out;
}
