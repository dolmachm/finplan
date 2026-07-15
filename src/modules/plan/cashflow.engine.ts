import type {
  DeterministicPlanResult,
  MonthlyProjection,
  PlanInput,
  ScenarioAssetPurchase,
  ScenarioAssetSale,
  ScenarioModifiers,
} from "./types";
import { amountForMonth } from "./frequency";
import { analyzeGoalFunding } from "./goal-funding";

type TrackedAsset = PlanInput["assets"][number] & { sold: boolean };

function collectSales(mods?: ScenarioModifiers): ScenarioAssetSale[] {
  if (!mods) return [];
  const list = [...(mods.assetSales ?? [])];
  if (mods.assetSale) list.push(mods.assetSale);
  return list;
}

function applyModifiers(
  base: PlanInput,
  mods?: ScenarioModifiers,
): PlanInput {
  if (!mods) return base;
  const m = mods;
  const inflation =
    base.baseInflationPct * (m.inflationMultiplier ?? 1) +
    (m.inflationDeltaPct ?? 0);
  const divMul = m.dividendMultiplier ?? 1;
  return {
    ...base,
    assets: base.assets.map((a) => ({
      ...a,
      currentValue: a.currentValue * (1 + (m.assetShockPct ?? 0) / 100),
      expectedReturnPct: a.expectedReturnPct * (m.returnMultiplier ?? 1),
      dividendIncomeMonthly: a.dividendIncomeMonthly * divMul,
    })),
    baseInflationPct: inflation,
    expenses: base.expenses.map((e) => ({
      ...e,
      amount: e.amount * (1 - (m.expenseCutPct ?? 0) / 100),
    })),
  };
}

function activeValue(assets: TrackedAsset[]) {
  return assets.filter((a) => !a.sold).reduce((s, a) => s + a.currentValue, 0);
}

export function runDeterministicPlan(
  input: PlanInput,
  modifiers?: ScenarioModifiers,
): DeterministicPlanResult {
  const plan = applyModifiers(input, modifiers);
  const monthlyInflation = Math.pow(1 + plan.baseInflationPct / 100, 1 / 12) - 1;
  const sales = collectSales(modifiers);
  const purchases: ScenarioAssetPurchase[] = modifiers?.assetPurchases ?? [];

  const tracked: TrackedAsset[] = plan.assets.map((a) => ({ ...a, sold: false }));
  let cashFromSales = 0;
  let debtTotal = plan.liabilities.reduce((s, l) => s + l.remainingBalance, 0);

  const monthly: MonthlyProjection[] = [];
  let surplusSum = 0;

  for (let m = 0; m < plan.horizonMonths; m++) {
    const inflationFactor = Math.pow(1 + monthlyInflation, m);

    for (const sale of sales) {
      if (sale.monthIndex !== m) continue;
      const asset = tracked.find((a) => a.id === sale.assetId && !a.sold);
      if (!asset) continue;
      // Remove asset from portfolio (stop future return/dividend), keep net cash
      cashFromSales += sale.proceeds;
      asset.sold = true;
      asset.currentValue = 0;
      asset.dividendIncomeMonthly = 0;
    }

    for (const buy of purchases) {
      if (buy.monthIndex !== m) continue;
      const amount = Math.min(buy.amount, Math.max(0, cashFromSales));
      if (amount <= 0) continue;
      cashFromSales -= amount;
      tracked.push({
        id: `purchase_${m}_${tracked.length}`,
        name: buy.name || "Новый актив",
        type: "BROKERAGE",
        currentValue: amount,
        expectedReturnPct: buy.expectedReturnPct,
        volatilityPct: 15,
        maintenanceCostMonthly: 0,
        dividendIncomeMonthly: buy.dividendIncomeMonthly,
        liquidityDays: 3,
        sold: false,
      });
    }

    let income = 0;
    for (const inc of plan.incomes) {
      const growth = Math.pow(1 + inc.growthRatePct / 100, m / 12);
      const gross = amountForMonth(inc.amount, inc.frequency, m) * growth;
      if (modifiers?.incomeLossMonths && m < modifiers.incomeLossMonths) continue;
      income += gross * (1 - inc.taxRatePct / 100);
    }

    let expenses = 0;
    for (const exp of plan.expenses) {
      const growth = Math.pow(1 + exp.growthRatePct / 100, m / 12);
      expenses +=
        amountForMonth(exp.amount, exp.frequency, m) * growth * inflationFactor;
    }
    for (const a of tracked) {
      if (!a.sold) expenses += a.maintenanceCostMonthly * inflationFactor;
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
    const pool = activeValue(tracked);
    for (const a of tracked) {
      if (a.sold || a.currentValue <= 0) continue;
      const monthlyReturn = Math.pow(1 + a.expectedReturnPct / 100, 1 / 12) - 1;
      const growth = a.currentValue * monthlyReturn;
      a.currentValue += growth;
      investmentReturn += growth + a.dividendIncomeMonthly;
    }
    // Idle cash from sales earns 0 in MVP (conservative)

    const cashflow = income + investmentReturn - expenses - debtPayments;
    // Apply net cashflow to largest active asset (or hold as cash)
    if (cashflow !== 0) {
      const active = tracked.filter((a) => !a.sold);
      if (active.length > 0) {
        const main = active.reduce((b, a) =>
          a.currentValue >= b.currentValue ? a : b,
        );
        main.currentValue = Math.max(0, main.currentValue + cashflow);
      } else {
        cashFromSales = Math.max(0, cashFromSales + cashflow);
      }
    }

    void pool;
    surplusSum += cashflow;
    const netWorth = activeValue(tracked) + cashFromSales - debtTotal;
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

  const n = monthly.length || 1;
  const avgMonthlySurplus = surplusSum / n;
  const goalFunding = analyzeGoalFunding(plan, monthly, avgMonthlySurplus);

  return {
    monthly,
    goalFunding,
    summary: {
      finalNetWorth: monthly[monthly.length - 1]?.netWorth ?? 0,
      avgMonthlySurplus,
      recommendedMonthlySaving: goalFunding.reduce(
        (s, g) => s + g.requiredMonthlyDesired,
        0,
      ),
    },
  };
}
