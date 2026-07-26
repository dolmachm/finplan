import { loadUserFinanceSnapshot } from "@/modules/finance/finance-snapshot";
import { activeLiabilities } from "@/modules/finance/liability-status";
import type { Asset, Expense, Goal, Income, Liability, MacroSettings } from "@/shared/types";
import { differenceInMonths, startOfMonth } from "date-fns";
import type { PlanInput } from "./types";

/** Собирает PlanInput из уже загруженных сущностей (без повторных Redis-чтений). */
export function buildPlanInputFromEntities(
  userId: string,
  data: {
    macro: MacroSettings | null;
    assets: Asset[];
    liabilities: Liability[];
    incomes: Income[];
    expenses: Expense[];
    goals: Goal[];
  },
): PlanInput {
  const { macro, assets, liabilities, incomes, expenses, goals } = data;
  const horizonYears = macro?.planHorizonYears ?? 30;
  const horizonMonths = horizonYears * 12;
  const now = startOfMonth(new Date());

  return {
    userId,
    horizonMonths,
    baseInflationPct: macro?.baseInflationPct ?? 4,
    incomeTaxPct: macro?.incomeTaxPct ?? 13,
    assets: assets.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      currentValue: a.currentValue,
      expectedReturnPct: a.expectedReturnPct,
      volatilityPct: a.volatilityPct,
      maintenanceCostMonthly: a.maintenanceCostMonthly,
      dividendIncomeMonthly: a.dividendIncomeMonthly,
      liquidityDays: a.liquidityDays,
    })),
    liabilities: activeLiabilities(liabilities, now).map((l) => ({
      remainingBalance: l.remainingBalance,
      monthlyPayment: l.monthlyPayment,
      interestRatePct: l.interestRatePct,
      urgency: l.urgency ?? "MEDIUM",
      endMonthIndex: l.endDate
        ? Math.max(0, differenceInMonths(startOfMonth(new Date(l.endDate)), now))
        : null,
    })),
    incomes: incomes.map((i) => ({
      amount: i.amount,
      frequency: i.frequency,
      taxRatePct: i.taxRatePct,
      growthRatePct: i.growthRatePct,
    })),
    expenses: expenses.map((e) => ({
      amount: e.amount,
      frequency: e.frequency,
      growthRatePct: e.growthRatePct,
      isEssential: e.isEssential,
    })),
    goals: goals.map((g) => {
      const stages = (g.stages ?? []).map((s) => ({
        id: s.id,
        label: s.label,
        amount: s.amount,
        monthIndex: Math.max(
          0,
          differenceInMonths(startOfMonth(new Date(s.targetDate)), now),
        ),
      }));
      const lastStageMonth =
        stages.length > 0
          ? Math.max(...stages.map((s) => s.monthIndex))
          : Math.max(
              0,
              differenceInMonths(startOfMonth(g.targetDate), now),
            );
      return {
        id: g.id,
        name: g.name,
        targetAmountNominal: g.targetAmountNominal,
        targetMonthIndex: lastStageMonth,
        priority: g.priority ?? 1,
        allowPartialFunding: g.allowPartialFunding ?? true,
        minAmount: g.minAmount ?? null,
        maxAmount: g.maxAmount ?? null,
        stages,
      };
    }),
  };
}

/**
 * Каноническая загрузка входа плана: делегирует в loadUserFinanceSnapshot,
 * чтобы projection/compare/sim не дублировали свой Promise.all по сущностям.
 */
export async function loadPlanInputForUser(userId: string): Promise<PlanInput> {
  const snap = await loadUserFinanceSnapshot(userId);
  return buildPlanInputFromEntities(userId, {
    macro: snap.macro,
    assets: snap.assets,
    liabilities: snap.liabilities,
    incomes: snap.incomes,
    expenses: snap.expenses,
    goals: snap.goals,
  });
}
