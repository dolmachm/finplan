import { prisma } from "@/shared/db";
import { archiveExpiredLiabilities } from "@/modules/finance/archive-liabilities";
import { syncAssetFromHoldings } from "@/modules/finance/portfolio-math";
import type {
  Asset,
  BudgetCategory,
  Expense,
  Goal,
  Income,
  Liability,
  MacroSettings,
  Scenario,
} from "@/shared/types";

/**
 * Полный набор финансовых сущностей пользователя для CRUD и расчётов.
 * Тяжелее summary: в ответе клиенту уходят массивы записей.
 */
export type FinanceSnapshot = {
  assets: Asset[];
  liabilities: Liability[];
  incomes: Income[];
  expenses: Expense[];
  goals: Goal[];
  budgetCategories: BudgetCategory[];
  scenarios: Scenario[];
  macro: MacroSettings | null;
};

/**
 * Один параллельный batch Redis (8 findMany/findUnique) — канонический loader
 * для snapshot API, summary и plan-input.
 */
export async function loadUserFinanceSnapshot(
  userId: string,
): Promise<FinanceSnapshot> {
  const [
    assets,
    liabilities,
    incomes,
    expenses,
    goals,
    budgetCategories,
    scenarios,
    macro,
  ] = await Promise.all([
    prisma.asset.findMany({ where: { userId } }),
    prisma.liability.findMany({ where: { userId } }),
    prisma.income.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
    prisma.goal.findMany({ where: { userId }, orderBy: { priority: "asc" } }),
    prisma.budgetCategory.findMany({
      where: { userId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.scenario.findMany({ where: { userId } }),
    prisma.macroSettings.findUnique({ where: { userId } }),
  ]);

  return {
    assets: (assets as Asset[]).map(syncAssetFromHoldings),
    liabilities: (await archiveExpiredLiabilities(
      liabilities as Liability[],
    )) as Liability[],
    incomes: incomes as Income[],
    expenses: expenses as Expense[],
    goals: goals as Goal[],
    budgetCategories: budgetCategories as BudgetCategory[],
    scenarios: scenarios as Scenario[],
    macro: macro as MacroSettings | null,
  };
}
