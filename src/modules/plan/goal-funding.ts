import type {
  GoalFundingResult,
  GoalFundingStageResult,
  MonthlyProjection,
  PlanInput,
} from "./types";

function inflate(amount: number, inflationPct: number, months: number) {
  return amount * Math.pow(1 + inflationPct / 100, Math.max(0, months) / 12);
}

function resolveBands(g: PlanInput["goals"][number]) {
  const desired = g.targetAmountNominal;
  const min =
    g.minAmount != null && g.minAmount > 0
      ? g.minAmount
      : g.allowPartialFunding
        ? desired * 0.8
        : desired;
  const max =
    g.maxAmount != null && g.maxAmount >= desired ? g.maxAmount : desired;
  return { min, desired, max };
}

function resolveStages(g: PlanInput["goals"][number]) {
  if (g.stages.length > 0) {
    return [...g.stages].sort((a, b) => a.monthIndex - b.monthIndex);
  }
  return [
    {
      id: `${g.id}-main`,
      label: "Основной этап",
      amount: g.targetAmountNominal,
      monthIndex: g.targetMonthIndex,
    },
  ];
}

/**
 * Приоритетное распределение профицита и капитала:
 * 1) цели по priority asc; 2) этапы по дате;
 * капитал, уже «забронированный» старшими целями, недоступен младшим.
 */
export function analyzeGoalFunding(
  plan: PlanInput,
  monthly: MonthlyProjection[],
  avgMonthlySurplus: number,
): GoalFundingResult[] {
  const inflation = plan.baseInflationPct;
  const sorted = [...plan.goals].sort((a, b) => a.priority - b.priority);
  const reservations: Array<{ monthIndex: number; amount: number }> = [];
  let remainingSurplus = Math.max(0, avgMonthlySurplus);
  const results: GoalFundingResult[] = [];

  for (const g of sorted) {
    const bands = resolveBands(g);
    const stages = resolveStages(g);
    const lastMonth = Math.max(0, ...stages.map((s) => s.monthIndex), g.targetMonthIndex);
    const monthsToGoal = Math.max(1, lastMonth);

    const nwAt = (m: number) =>
      monthly[Math.min(Math.max(0, m), monthly.length - 1)]?.netWorth ?? 0;

    const reservedAt = (m: number) =>
      reservations
        .filter((r) => r.monthIndex <= m)
        .reduce((s, r) => s + r.amount, 0);

    const projectedBalanceAtTarget = nwAt(lastMonth);
    const reservedByHigherPriority = reservedAt(lastMonth);
    const availableAtTarget = Math.max(
      0,
      projectedBalanceAtTarget - reservedByHigherPriority,
    );

    const stageResults: GoalFundingStageResult[] = [];
    let requiredMonthlyDesired = 0;

    for (const st of stages) {
      const m = Math.max(1, st.monthIndex);
      const amountInflated = inflate(st.amount, inflation, m);
      const available = Math.max(0, nwAt(m) - reservedAt(m));
      const gap = Math.max(0, amountInflated - available);
      const requiredMonthly = gap / m;
      requiredMonthlyDesired += requiredMonthly;
      stageResults.push({
        id: st.id,
        label: st.label,
        monthIndex: m,
        amountInflated,
        requiredMonthly,
        funded: false,
      });
    }

    const inflationAdjustedDesired = inflate(bands.desired, inflation, monthsToGoal);
    const inflationAdjustedMin = inflate(bands.min, inflation, monthsToGoal);
    const inflationAdjustedMax = inflate(bands.max, inflation, monthsToGoal);

    // Если этапы заданы — gap считается по ним; иначе от баланса на конечную дату
    if (stages.length === 1 && g.stages.length === 0) {
      const gapD = Math.max(0, inflationAdjustedDesired - availableAtTarget);
      const gapMin = Math.max(0, inflationAdjustedMin - availableAtTarget);
      const gapMax = Math.max(0, inflationAdjustedMax - availableAtTarget);
      requiredMonthlyDesired = gapD / monthsToGoal;
      stageResults[0]!.requiredMonthly = requiredMonthlyDesired;
      stageResults[0]!.amountInflated = inflationAdjustedDesired;

      const requiredMonthlyMin = gapMin / monthsToGoal;
      const requiredMonthlyMax = gapMax / monthsToGoal;

      const allocated = Math.min(requiredMonthlyDesired, remainingSurplus);
      remainingSurplus = Math.max(0, remainingSurplus - allocated);

      const fundedWealth = availableAtTarget + allocated * monthsToGoal;
      const achievability =
        fundedWealth >= inflationAdjustedMax - 1
          ? "max"
          : fundedWealth >= inflationAdjustedDesired - 1
            ? "desired"
            : fundedWealth >= inflationAdjustedMin - 1
              ? "min"
              : "none";

      stageResults[0]!.funded = fundedWealth >= inflationAdjustedDesired - 1;
      reservations.push({
        monthIndex: lastMonth,
        amount: Math.min(inflationAdjustedDesired, fundedWealth),
      });

      results.push({
        goalId: g.id,
        priority: g.priority,
        monthsToGoal,
        minAmount: bands.min,
        desiredAmount: bands.desired,
        maxAmount: bands.max,
        inflationAdjustedMin,
        inflationAdjustedDesired,
        inflationAdjustedMax,
        projectedBalanceAtTarget,
        reservedByHigherPriority,
        availableAtTarget,
        requiredMonthlySaving: requiredMonthlyDesired,
        requiredMonthlyMin,
        requiredMonthlyDesired,
        requiredMonthlyMax,
        allocatedMonthlySaving: allocated,
        achievability,
        stages: stageResults,
      });
      continue;
    }

    // Многоэтапная цель: взнос = сумма по этапам; достижимость по сумме этапов
    const totalInflatedStages = stageResults.reduce((s, x) => s + x.amountInflated, 0);
    const requiredMonthlyMin =
      inflationAdjustedDesired > 0
        ? requiredMonthlyDesired * (inflationAdjustedMin / inflationAdjustedDesired)
        : 0;
    const requiredMonthlyMax =
      inflationAdjustedDesired > 0
        ? requiredMonthlyDesired * (inflationAdjustedMax / inflationAdjustedDesired)
        : requiredMonthlyDesired;

    const allocated = Math.min(requiredMonthlyDesired, remainingSurplus);
    remainingSurplus = Math.max(0, remainingSurplus - allocated);
    const coverRatio =
      requiredMonthlyDesired > 0 ? allocated / requiredMonthlyDesired : 1;

    for (const st of stageResults) {
      st.funded = coverRatio >= 0.999;
      reservations.push({
        monthIndex: st.monthIndex,
        amount: st.amountInflated * Math.min(1, coverRatio),
      });
    }

    const fundedWealth =
      availableAtTarget + allocated * monthsToGoal;
    const achievability =
      coverRatio >= 0.999 && totalInflatedStages >= inflationAdjustedMax * 0.99
        ? "max"
        : coverRatio >= 0.999
          ? "desired"
          : fundedWealth >= inflationAdjustedMin - 1 || coverRatio >= 0.8
            ? "min"
            : "none";

    results.push({
      goalId: g.id,
      priority: g.priority,
      monthsToGoal,
      minAmount: bands.min,
      desiredAmount: bands.desired,
      maxAmount: bands.max,
      inflationAdjustedMin,
      inflationAdjustedDesired: totalInflatedStages || inflationAdjustedDesired,
      inflationAdjustedMax,
      projectedBalanceAtTarget,
      reservedByHigherPriority,
      availableAtTarget,
      requiredMonthlySaving: requiredMonthlyDesired,
      requiredMonthlyMin,
      requiredMonthlyDesired,
      requiredMonthlyMax,
      allocatedMonthlySaving: allocated,
      achievability,
      stages: stageResults,
    });
  }

  return results;
}
