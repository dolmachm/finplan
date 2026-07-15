import { prisma } from "@/shared/db";
import type { Asset, Expense, Goal, Income, Liability, MacroSettings } from "@/shared/types";
import { differenceInMonths, startOfMonth } from "date-fns";
import type { PlanInput } from "./types";

export async function loadPlanInputForUser(userId: string): Promise<PlanInput> {
  const [macro, assets, liabilities, incomes, expenses, goals] =
    await Promise.all([
      prisma.macroSettings.findUnique({ where: { userId } }),
      prisma.asset.findMany({ where: { userId } }),
      prisma.liability.findMany({ where: { userId } }),
      prisma.income.findMany({ where: { userId } }),
      prisma.expense.findMany({ where: { userId } }),
      prisma.goal.findMany({ where: { userId }, orderBy: { priority: "asc" } }),
    ]) as [
      MacroSettings | null,
      Asset[],
      Liability[],
      Income[],
      Expense[],
      Goal[],
    ];

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
    liabilities: liabilities.map((l) => ({
      remainingBalance: l.remainingBalance,
      monthlyPayment: l.monthlyPayment,
      interestRatePct: l.interestRatePct,
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
