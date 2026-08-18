import type { PlanInput, ScenarioModifiers } from "@/modules/plan/types";
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
  modifiers?: ScenarioModifiers;
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

const CHUNK = 40;

function yieldEventLoop() {
  return new Promise<void>((resolve) => {
    if (typeof setImmediate === "function") setImmediate(resolve);
    else setTimeout(resolve, 0);
  });
}

/** Shock/return/vol/div already baked into assets for this path. */
function pathModifiers(mods?: ScenarioModifiers): ScenarioModifiers | undefined {
  if (!mods) return undefined;
  return {
    ...mods,
    returnMultiplier: 1,
    volatilityMultiplier: 1,
    dividendMultiplier: 1,
    assetShockPct: 0,
  };
}

function runOnePath(
  baseInput: PlanInput,
  horizonMonths: number,
  chol: number[][],
  modifiers: ScenarioModifiers | undefined,
  applyCrisis: boolean,
) {
  const retMul = modifiers?.returnMultiplier ?? 1;
  const volMul = modifiers?.volatilityMultiplier ?? 1;
  const divMul = modifiers?.dividendMultiplier ?? 1;
  const crisisShockPct = applyCrisis ? (modifiers?.assetShockPct ?? 0) : 0;
  const perturbedAssets = baseInput.assets.map((a, i) => {
    const monthlyVol = ((a.volatilityPct * volMul) / 100) / Math.sqrt(12);
    const monthlyMu = ((a.expectedReturnPct * retMul) / 100) / 12;
    let logSum = 0;
    for (let m = 0; m < horizonMonths; m++) {
      const z1 = randn();
      const z2 = randn();
      const shock = i % 2 === 0 ? chol[0][0] * z1 : chol[1][0] * z1 + chol[1][1] * z2;
      logSum += monthlyMu + shock * monthlyVol;
    }
    const avgMonthly = logSum / Math.max(1, horizonMonths);
    let currentValue = a.currentValue;
    if (crisisShockPct) {
      currentValue *= 1 + crisisShockPct / 100;
    }
    return {
      ...a,
      expectedReturnPct: (Math.pow(1 + avgMonthly, 12) - 1) * 100,
      dividendIncomeMonthly: a.dividendIncomeMonthly * divMul,
      currentValue,
    };
  });

  return runDeterministicPlan(
    {
      ...baseInput,
      horizonMonths,
      assets: perturbedAssets,
    },
    pathModifiers(modifiers),
  );
}

/** Асинхронный MC: чанки + yield, чтобы прогресс писался в Redis и UI не залипал на 0%. */
export async function runMonteCarlo(
  baseInput: PlanInput,
  params: MonteCarloParams,
  onProgress?: (pct: number) => void | Promise<void>,
): Promise<MonteCarloResult> {
  const {
    numRuns,
    horizonMonths,
    correlation = 0.3,
    crisisShockPct,
    modifiers,
  } = params;
  const mods: ScenarioModifiers = {
    ...(modifiers ?? {}),
    assetShockPct: modifiers?.assetShockPct ?? crisisShockPct,
  };
  const chol = cholesky2x2(correlation);
  const inflationPct = (() => {
    const inf =
      baseInput.baseInflationPct * (mods.inflationMultiplier ?? 1) +
      (mods.inflationDeltaPct ?? 0);
    return inf;
  })();

  const finalWealth: number[] = [];
  const allPaths: number[][] = [];
  const goalHits: Record<string, number[]> = {};
  const goalWealth: Record<string, number[]> = {};
  for (const g of baseInput.goals) {
    goalHits[g.id] = [];
    goalWealth[g.id] = [];
  }

  let sampleWorst: number[] = [];
  let sampleBest: number[] = [];
  let worstFinal = Infinity;
  let bestFinal = -Infinity;

  await onProgress?.(1);

  for (let run = 0; run < numRuns; run++) {
    const applyCrisis = !!(mods.assetShockPct && run < numRuns * 0.15);
    const planResult = runOnePath(
      baseInput,
      horizonMonths,
      chol,
      mods,
      applyCrisis,
    );

    const nw = planResult.monthly.map((x) => x.netWorth);
    const final = nw[nw.length - 1] ?? 0;
    finalWealth.push(final);
    allPaths.push(nw);

    for (const g of baseInput.goals) {
      const idx = Math.min(Math.max(0, g.targetMonthIndex), nw.length - 1);
      const atGoal = nw[idx] ?? 0;
      const inflatedTarget =
        g.targetAmountNominal *
        Math.pow(1 + inflationPct / 100, g.targetMonthIndex / 12);
      const minShare =
        g.minAmount != null && g.targetAmountNominal > 0
          ? g.minAmount / g.targetAmountNominal
          : g.allowPartialFunding
            ? 0.8
            : 1;
      const threshold = Math.min(1, Math.max(0, minShare));
      goalHits[g.id].push(atGoal >= inflatedTarget * threshold ? 1 : 0);
      goalWealth[g.id].push(atGoal);
    }

    if (final < worstFinal) {
      worstFinal = final;
      sampleWorst = nw;
    }
    if (final > bestFinal) {
      bestFinal = final;
      sampleBest = nw;
    }

    if (run % CHUNK === 0 || run === numRuns - 1) {
      await onProgress?.(Math.max(1, Math.round(((run + 1) / numRuns) * 95)));
      await yieldEventLoop();
    }
  }

  const sortedFinal = [...finalWealth].sort((a, b) => a - b);
  const medianWealth = percentile(sortedFinal, 0.5);
  let medianIdx = 0;
  let medianDist = Infinity;
  for (let i = 0; i < finalWealth.length; i++) {
    const d = Math.abs(finalWealth[i]! - medianWealth);
    if (d < medianDist) {
      medianDist = d;
      medianIdx = i;
    }
  }
  const sampleMedian = allPaths[medianIdx] ?? sampleWorst;

  const goalResults: GoalMonteCarloResult[] = baseInput.goals.map((g) => {
    const hits = goalHits[g.id];
    const wealth = [...(goalWealth[g.id] ?? [])].sort((a, b) => a - b);
    const prob = hits.reduce((s, h) => s + h, 0) / numRuns;
    return {
      goalId: g.id,
      probability: prob,
      median: percentile(wealth, 0.5),
      p5: percentile(wealth, 0.05),
      p95: percentile(wealth, 0.95),
    };
  });

  await onProgress?.(100);

  return {
    goalResults,
    wealthAtHorizon: {
      p5: percentile(sortedFinal, 0.05),
      median: percentile(sortedFinal, 0.5),
      p95: percentile(sortedFinal, 0.95),
    },
    samplePaths: [
      { label: "worst", netWorth: sampleWorst },
      { label: "median", netWorth: sampleMedian },
      { label: "best", netWorth: sampleBest },
    ],
    progress: 100,
  };
}

export async function runSensitivity(
  baseInput: PlanInput,
  runs: number = 80,
  modifiers?: ScenarioModifiers,
): Promise<Record<string, GoalMonteCarloResult[]>> {
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
    const mc = await runMonteCarlo(modified, {
      numRuns: runs,
      horizonMonths: baseInput.horizonMonths,
      modifiers,
    });
    out[d.key] = mc.goalResults;
  }
  return out;
}
