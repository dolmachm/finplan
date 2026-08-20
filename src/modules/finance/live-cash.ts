import { monthlyNetIncome, monthlyTotal } from "@/modules/plan/frequency";
import { activeLiabilities } from "@/modules/finance/liability-status";
import { budgetExpenseFloor } from "@/modules/budget/envelopes";
import type {
  Asset,
  BudgetCategory,
  Expense,
  Income,
  Liability,
} from "@/shared/types";

/** Живой кэшфлоу из строк income / expense / asset / liability — без копий. */
export function liveCashflow(input: {
  incomes: Income[];
  expenses: Expense[];
  assets: Asset[];
  liabilities: Liability[];
}) {
  const incomeMonthly = monthlyNetIncome(input.incomes);
  const expenseMonthly = monthlyTotal(input.expenses);
  const debtServiceMonthly = activeLiabilities(input.liabilities).reduce(
    (s, l) => s + l.monthlyPayment,
    0,
  );
  const dividendMonthly = input.assets.reduce(
    (s, a) => s + (a.dividendIncomeMonthly ?? 0),
    0,
  );
  const maintenanceMonthly = input.assets.reduce(
    (s, a) => s + (a.maintenanceCostMonthly ?? 0),
    0,
  );
  return {
    incomeMonthly,
    expenseMonthly,
    debtServiceMonthly,
    dividendMonthly,
    maintenanceMonthly,
    surplusMonthly:
      incomeMonthly +
      dividendMonthly -
      expenseMonthly -
      debtServiceMonthly -
      maintenanceMonthly,
  };
}

/**
 * Профицит для плана/iPlan: расходная сторона не ниже floor конвертов
 * (max(сумма шаблонов, сумма лимитов)). Операции в расчёт не входят.
 */
export function planSurplusMonthly(input: {
  incomes: Income[];
  expenses: Expense[];
  assets: Asset[];
  liabilities: Liability[];
  budgetCategories?: BudgetCategory[];
}): number {
  const cash = liveCashflow(input);
  const floor = budgetExpenseFloor(
    input.expenses,
    input.budgetCategories ?? [],
  );
  return (
    cash.incomeMonthly +
    cash.dividendMonthly -
    floor -
    cash.debtServiceMonthly -
    cash.maintenanceMonthly
  );
}
