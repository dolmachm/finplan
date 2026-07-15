import type { GoalFundingResult } from "./types";

export type GoalPathKind = "SAVE" | "LOAN" | "HYBRID" | "CAPITAL";

export type GoalPathSettings = {
  /** Выбранный пользователем путь; null → следовать рекомендации */
  preferredKind: GoalPathKind | null;
  loanRatePct: number;
  loanTermMonths: number;
  /** Доля первоначального взноса для HYBRID, % */
  downPaymentPct: number;
};

export const DEFAULT_GOAL_PATH_SETTINGS: GoalPathSettings = {
  preferredKind: null,
  loanRatePct: 14,
  loanTermMonths: 60,
  downPaymentPct: 30,
};

export type GoalPathOption = {
  kind: GoalPathKind;
  label: string;
  monthlyOutflow: number;
  totalCost: number;
  months: number;
  feasible: boolean;
  /** Меньше — лучше */
  score: number;
  note: string;
};

export type GoalPathAnalysis = {
  options: GoalPathOption[];
  recommendedKind: GoalPathKind;
  selectedKind: GoalPathKind;
  settings: GoalPathSettings;
};

/** Аннуитетный платёж */
export function loanPayment(principal: number, annualRatePct: number, months: number) {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r <= 0) return principal / months;
  const f = Math.pow(1 + r, months);
  return (principal * r * f) / (f - 1);
}

export function normalizePathSettings(
  raw?: Partial<GoalPathSettings> | null,
): GoalPathSettings {
  return {
    preferredKind: raw?.preferredKind ?? null,
    loanRatePct: Math.min(50, Math.max(0, raw?.loanRatePct ?? DEFAULT_GOAL_PATH_SETTINGS.loanRatePct)),
    loanTermMonths: Math.min(360, Math.max(1, raw?.loanTermMonths ?? DEFAULT_GOAL_PATH_SETTINGS.loanTermMonths)),
    downPaymentPct: Math.min(90, Math.max(0, raw?.downPaymentPct ?? DEFAULT_GOAL_PATH_SETTINGS.downPaymentPct)),
  };
}

/**
 * Варианты достижения цели: накопление / кредит / гибрид / из капитала.
 * Лучший = минимальная полная стоимость среди выполнимых при профиците.
 */
export function analyzeGoalPaths(args: {
  targetAmount: number;
  monthsToGoal: number;
  avgMonthlySurplus: number;
  funding?: GoalFundingResult;
  settings?: Partial<GoalPathSettings> | null;
}): GoalPathAnalysis {
  const settings = normalizePathSettings(args.settings);
  const amount = Math.max(0, args.targetAmount);
  const months = Math.max(1, args.monthsToGoal);
  const surplus = Math.max(0, args.avgMonthlySurplus);
  const available = args.funding?.availableAtTarget ?? 0;
  const saveMonthly =
    args.funding?.requiredMonthlyDesired ?? amount / months;

  const options: GoalPathOption[] = [];

  // 1) Накопления
  {
    const monthly = saveMonthly;
    const feasible = surplus + 1 >= monthly || monthly <= 0;
    const totalCost = monthly * months;
    options.push({
      kind: "SAVE",
      label: "Накопления",
      monthlyOutflow: monthly,
      totalCost,
      months,
      feasible,
      score: feasible ? totalCost : totalCost + 1e12,
      note: feasible
        ? "Копите из профицита до срока цели"
        : "Профицита не хватает на нужный взнос",
    });
  }

  // 2) Кредит на всю сумму
  {
    const n = settings.loanTermMonths;
    const monthly = loanPayment(amount, settings.loanRatePct, n);
    const totalCost = monthly * n;
    const feasible = surplus + 1 >= monthly || monthly <= 0;
    options.push({
      kind: "LOAN",
      label: "Кредит",
      monthlyOutflow: monthly,
      totalCost,
      months: n,
      feasible,
      score: feasible ? totalCost : totalCost + 1e12,
      note: feasible
        ? `Аннуитет ${settings.loanRatePct}% годовых, ${n} мес.`
        : "Платёж выше доступного профицита",
    });
  }

  // 3) Гибрид: первоначальный взнос + кредит
  {
    const down = amount * (settings.downPaymentPct / 100);
    const principal = Math.max(0, amount - down);
    const saveM = down / months;
    const loanM = loanPayment(principal, settings.loanRatePct, settings.loanTermMonths);
    const monthly = saveM + loanM;
    const totalCost = saveM * months + loanM * settings.loanTermMonths;
    const feasible = surplus + 1 >= monthly || monthly <= 0;
    options.push({
      kind: "HYBRID",
      label: "Взнос + кредит",
      monthlyOutflow: monthly,
      totalCost,
      months: Math.max(months, settings.loanTermMonths),
      feasible,
      score: feasible ? totalCost : totalCost + 1e12,
      note: `Первый взнос ${settings.downPaymentPct}% + кредит на остаток`,
    });
  }

  // 4) Из уже доступного капитала (к сроку)
  {
    const feasible = available + 1 >= amount;
    const monthly = 0;
    const totalCost = amount;
    options.push({
      kind: "CAPITAL",
      label: "Из капитала",
      monthlyOutflow: monthly,
      totalCost,
      months: 0,
      feasible,
      score: feasible ? totalCost * 0.95 : totalCost + 1e12,
      note: feasible
        ? "К сроку цель покрывается доступным капиталом (с учётом приоритетов)"
        : "Капитала к сроку недостаточно",
    });
  }

  const feasible = options.filter((o) => o.feasible);
  const pool = feasible.length > 0 ? feasible : options;
  const recommendedKind = pool.reduce((a, b) => (a.score <= b.score ? a : b)).kind;
  const selectedKind = settings.preferredKind ?? recommendedKind;

  return { options, recommendedKind, selectedKind, settings };
}
