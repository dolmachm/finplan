import type {
  DeterministicPlanResult,
  MonthlyProjection,
  PlanInput,
  ScenarioModifiers,
} from "./types";
import { amountForMonth } from "./frequency";

function applyModifiers(
  base: PlanInput,
  mods?: ScenarioModifiers,
): PlanInput {
  if (!mods) return base;
  const m = mods;
  return {
    ...base,
    assets: base.assets.map((a) => ({
      ...a,
      currentValue: a.currentValue * (1 + (m.assetShockPct ?? 0) / 100),
      expectedReturnPct:
        a.expectedReturnPct * (m.returnMultiplier ?? 1),
    })),
    baseInflationPct: base.baseInflationPct * (m.inflationMultiplier ?? 1),
    expenses: base.expenses.map((e) => ({
      ...e,
      amount: e.amount * (1 - (m.expenseCutPct ?? 0) / 100),
    })),
  };
}

export function runDeterministicPlan(
  input: PlanInput,
  modifiers?: ScenarioModifiers,
): DeterministicPlanResult {
  const plan = applyModifiers(input, modifiers);
  const monthlyInflation = Math.pow(1 + plan.baseInflationPct / 100, 1 / 12) - 1;

  let portfolioValue = plan.assets.reduce((s, a) => s + a.currentValue, 0);
  let debtTotal = plan.liabilities.reduce((s, l) => s + l.remainingBalance, 0);

  const monthly: MonthlyProjection[] = [];
  let surplusSum = 0;

  for (let m = 0; m < plan.horizonMonths; m++) {
    const inflationFactor = Math.pow(1 + monthlyInflation, m);

    let income = 0;
    for (const inc of plan.incomes) {
      const growth = Math.pow(1 + inc.growthRatePct / 100, m / 12);
      const gross = amountForMonth(inc.amount, inc.frequency, m) * growth;
      if (modifiers?.incomeLossMonths && m < modifiers.incomeLossMonths) {
        continue;
      }
      income += gross * (1 - inc.taxRatePct / 100);
    }

    let expenses = 0;
    for (const exp of plan.expenses) {
      const growth = Math.pow(1 + exp.growthRatePct / 100, m / 12);
      expenses +=
        amountForMonth(exp.amount, exp.frequency, m) * growth * inflationFactor;
    }

    for (const a of plan.assets) {
      expenses += a.maintenanceCostMonthly * inflationFactor;
    }

    let debtPayments = 0;
    for (const l of plan.liabilities) {
      if (debtTotal > 0) {
        const interest = (debtTotal * (l.interestRatePct / 100)) / 12;
        const payment = Math.min(l.monthlyPayment, debtTotal + interest);
        debtPayments += payment;
        debtTotal = Math.max(0, debtTotal + interest - payment);
      }
    }

    let investmentReturn = 0;
    for (const a of plan.assets) {
      const weight = portfolioValue > 0 ? a.currentValue / portfolioValue : 0;
      const monthlyReturn = Math.pow(1 + a.expectedReturnPct / 100, 1 / 12) - 1;
      investmentReturn += portfolioValue * weight * monthlyReturn;
      investmentReturn += a.dividendIncomeMonthly;
    }

    if (modifiers?.assetSale && modifiers.assetSale.monthIndex === m) {
      portfolioValue += modifiers.assetSale.proceeds;
    }

    const cashflow = income + investmentReturn - expenses - debtPayments;
    portfolioValue += cashflow;
    surplusSum += cashflow;

    const netWorth = portfolioValue - debtTotal;
    monthly.push({
      month: m,
      netWorth,
      cashflow,
      income,
      expenses,
      debtPayments,
      investmentReturn,
    });
  }

  const goalFunding = plan.goals.map((g) => {
    const monthsToGoal = Math.max(1, g.targetMonthIndex);
    const inflationAdjustedTarget =
      g.targetAmountNominal *
      Math.pow(1 + plan.baseInflationPct / 100, monthsToGoal / 12);
    const projectedBalanceAtTarget =
      monthly[Math.min(g.targetMonthIndex, monthly.length - 1)]?.netWorth ?? 0;
    const gap = Math.max(0, inflationAdjustedTarget - projectedBalanceAtTarget);
    const requiredMonthlySaving = gap / monthsToGoal;
    return {
      goalId: g.id,
      requiredMonthlySaving,
      projectedBalanceAtTarget,
      inflationAdjustedTarget,
    };
  });

  const recommendedMonthlySaving = [...plan.goals]
    .sort((a, b) => a.priority - b.priority)
    .reduce((sum, g) => {
      const funding = goalFunding.find((f) => f.goalId === g.id);
      return sum + (funding?.requiredMonthlySaving ?? 0);
    }, 0);

  return {
    monthly,
    goalFunding,
    summary: {
      finalNetWorth: monthly[monthly.length - 1]?.netWorth ?? 0,
      avgMonthlySurplus: surplusSum / plan.horizonMonths,
      recommendedMonthlySaving,
    },
  };
}
