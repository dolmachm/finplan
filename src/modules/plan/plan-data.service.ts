import { prisma } from "@/shared/db";
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
    ]);

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
    goals: goals.map((g) => ({
      id: g.id,
      name: g.name,
      targetAmountNominal: g.targetAmountNominal,
      targetMonthIndex: Math.max(
        0,
        differenceInMonths(startOfMonth(g.targetDate), now),
      ),
      priority: g.priority,
    })),
  };
}
