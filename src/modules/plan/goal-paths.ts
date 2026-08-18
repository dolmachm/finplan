import type { GoalFundingResult } from "./types";

export type GoalPathKind = "SAVE" | "LOAN" | "HYBRID" | "CAPITAL";

export type GoalPathSettings = {
  /** Выбранный пользователем путь; null → следовать рекомендации */
  preferredKind: GoalPathKind | null;
  loanRatePct: number;
  loanTermMonths: number;
  /** Доля первоначального взноса для HYBRID, % */
  downPaymentPct: number;
  /** true — срок кредита задан вручную; иначе берём срок цели */
  loanTermCustom?: boolean;
};

export const DEFAULT_GOAL_PATH_SETTINGS: GoalPathSettings = {
  preferredKind: null,
  loanRatePct: 14,
  loanTermMonths: 60,
  downPaymentPct: 30,
  loanTermCustom: false,
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

export type GoalPathBudget = {
  surplusMonthly: number;
  requiredMonthly: number;
  remainingMonthly: number;
  budgetOk: boolean;
  contributionAdvice: string;
  budgetAdvice: string;
};

export type GoalPathAnalysis = {
  options: GoalPathOption[];
  recommendedKind: GoalPathKind;
  selectedKind: GoalPathKind;
  settings: GoalPathSettings;
  budget: GoalPathBudget;
};

/** Аннуитетный платёж */
export function loanPayment(principal: number, annualRatePct: number, months: number) {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r <= 0) return principal / months;
  const f = Math.pow(1 + r, months);
  return (principal * r * f) / (f - 1);
}

/**
 * Параметры калькулятора из цели.
 * Срок кредита = срок цели, пока пользователь не зафиксировал свой.
 */
export function normalizePathSettings(
  raw?: Partial<GoalPathSettings> | null,
  goalMonths?: number,
): GoalPathSettings {
  const fromGoal =
    goalMonths != null && goalMonths > 0
      ? Math.min(360, Math.max(1, Math.round(goalMonths)))
      : DEFAULT_GOAL_PATH_SETTINGS.loanTermMonths;
  const custom = raw?.loanTermCustom === true;
  return {
    preferredKind: raw?.preferredKind ?? null,
    loanRatePct: Math.min(
      50,
      Math.max(0, raw?.loanRatePct ?? DEFAULT_GOAL_PATH_SETTINGS.loanRatePct),
    ),
    loanTermMonths: custom
      ? Math.min(360, Math.max(1, raw?.loanTermMonths ?? fromGoal))
      : fromGoal,
    downPaymentPct: Math.min(
      90,
      Math.max(0, raw?.downPaymentPct ?? DEFAULT_GOAL_PATH_SETTINGS.downPaymentPct),
    ),
    loanTermCustom: custom,
  };
}

function buildBudgetAdvice(
  surplus: number,
  required: number,
  selected: GoalPathOption,
  recommended: GoalPathKind,
): GoalPathBudget {
  const remaining = surplus - required;
  const inMinus = remaining < -1 || surplus < -1;
  const budgetOk = !inMinus;
  let contributionAdvice = "";
  if (inMinus) {
    contributionAdvice = "На цель нет денег: план уходит в минус.";
  } else if (selected.kind === "CAPITAL") {
    contributionAdvice = "Дополнительный взнос не нужен — цель покрывается капиталом.";
  } else if (required <= 0) {
    contributionAdvice = "Взнос ≈ 0 ₽/мес при текущих параметрах.";
  } else {
    contributionAdvice = `Рекомендуемый взнос/платёж: ≈ ${Math.round(required).toLocaleString("ru-RU")} ₽/мес (${selected.label}).`;
    if (selected.kind !== recommended) {
      contributionAdvice += ` Более выгодный путь по стоимости: ${recommended}.`;
    }
  }

  let budgetAdvice = "";
  if (inMinus) {
    budgetAdvice =
      surplus < -1
        ? `Доходы меньше расходов на ≈ ${Math.round(Math.abs(surplus)).toLocaleString("ru-RU")} ₽/мес. Пока бюджет в минусе, копить на цель нельзя.`
        : `Не хватает ≈ ${Math.round(Math.abs(remaining)).toLocaleString("ru-RU")} ₽/мес. Увеличьте доход, сократите расходы или снизьте сумму цели.`;
  } else if (remaining > 100) {
    budgetAdvice = `Бюджета хватает: после цели останется ≈ ${Math.round(remaining).toLocaleString("ru-RU")} ₽/мес.`;
  } else {
    budgetAdvice = "Бюджет на грани: почти всё свободное уходит на эту цель.";
  }

  return {
    surplusMonthly: surplus,
    requiredMonthly: required,
    remainingMonthly: remaining,
    budgetOk,
    contributionAdvice,
    budgetAdvice,
  };
}

/**
 * Варианты достижения цели: накопление / кредит / гибрид / из капитала.
 * Срок и сумма согласованы с целью; бюджет — с профицитом плана.
 */
export function analyzeGoalPaths(args: {
  targetAmount: number;
  monthsToGoal: number;
  avgMonthlySurplus: number;
  funding?: GoalFundingResult;
  settings?: Partial<GoalPathSettings> | null;
}): GoalPathAnalysis {
  const months = Math.max(1, args.monthsToGoal);
  const settings = normalizePathSettings(args.settings, months);
  const amount = Math.max(0, args.targetAmount);
  const surplus = args.avgMonthlySurplus;
  const available = args.funding?.availableAtTarget ?? 0;
  const saveMonthly =
    args.funding?.requiredMonthlyDesired ?? amount / months;

  const options: GoalPathOption[] = [];

  {
    const monthly = saveMonthly;
    const feasible = surplus + 1 >= monthly || monthly <= 0;
    const totalCost = monthly * months;
    options.push({
      kind: "SAVE",
      label: "Копить полностью",
      monthlyOutflow: monthly,
      totalCost,
      months,
      feasible,
      score: feasible ? totalCost : totalCost + 1e12,
      note: feasible
        ? `Откладывайте всю сумму ${months} мес. до срока цели`
        : "Профицита не хватает на нужный взнос",
    });
  }

  {
    const n = settings.loanTermMonths;
    const monthly = loanPayment(amount, settings.loanRatePct, n);
    const totalCost = monthly * n;
    const feasible = surplus + 1 >= monthly || monthly <= 0;
    options.push({
      kind: "LOAN",
      label: "Взять кредит",
      monthlyOutflow: monthly,
      totalCost,
      months: n,
      feasible,
      score: feasible ? totalCost : totalCost + 1e12,
      note: feasible
        ? `Платёж по кредиту: ${settings.loanRatePct}% · ${n} мес.${settings.loanTermCustom ? "" : " (= срок цели)"}`
        : "Платёж выше доступного профицита",
    });
  }

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
      label: "Часть копить, часть в кредит",
      monthlyOutflow: monthly,
      totalCost,
      months: Math.max(months, settings.loanTermMonths),
      feasible,
      score: feasible ? totalCost : totalCost + 1e12,
      note: `Сначала копите ${settings.downPaymentPct}% за ${months} мес., затем берёте кредит на остаток`,
    });
  }

  {
    const feasible = available + 1 >= amount && surplus >= -1;
    options.push({
      kind: "CAPITAL",
      label: "Из капитала",
      monthlyOutflow: 0,
      totalCost: amount,
      months: 0,
      feasible,
      score: feasible ? amount * 0.95 : amount + 1e12,
      note: feasible
        ? "К сроку цель покрывается доступным капиталом"
        : "Капитала к сроку недостаточно",
    });
  }

  const feasibleOpts = options.filter((o) => o.feasible);
  const pool = feasibleOpts.length > 0 ? feasibleOpts : options;
  const recommendedKind = pool.reduce((a, b) => (a.score <= b.score ? a : b)).kind;
  const selectedKind = settings.preferredKind ?? recommendedKind;
  const selected =
    options.find((o) => o.kind === selectedKind) ?? options[0]!;

  return {
    options,
    recommendedKind,
    selectedKind,
    settings,
    budget: buildBudgetAdvice(surplus, selected.monthlyOutflow, selected, recommendedKind),
  };
}

/** Сводка по всем целям: суммарный взнос vs профицит */
export function summarizeGoalsBudget(
  analyses: GoalPathAnalysis[],
  surplusMonthly: number,
) {
  const requiredMonthly = analyses.reduce(
    (s, a) => s + a.budget.requiredMonthly,
    0,
  );
  const remaining = surplusMonthly - requiredMonthly;
  const inMinus = remaining < -1 || surplusMonthly < -1;
  return {
    surplusMonthly,
    requiredMonthly,
    remainingMonthly: remaining,
    budgetOk: !inMinus,
    advice: inMinus
      ? surplusMonthly < -1
        ? `План в минусе: расходы выше доходов на ≈ ${Math.round(Math.abs(surplusMonthly)).toLocaleString("ru-RU")} ₽/мес. На цели нет свободных денег.`
        : `План в минусе: на цели нужно ≈ ${Math.round(requiredMonthly).toLocaleString("ru-RU")} ₽/мес, свободно ${Math.round(surplusMonthly).toLocaleString("ru-RU")} ₽ — нехватка ≈ ${Math.round(Math.abs(remaining)).toLocaleString("ru-RU")} ₽/мес.`
      : `На все выбранные пути нужно ≈ ${Math.round(requiredMonthly).toLocaleString("ru-RU")} ₽/мес при профиците ${Math.round(surplusMonthly).toLocaleString("ru-RU")} ₽ — бюджета хватает (остаток ≈ ${Math.round(remaining).toLocaleString("ru-RU")} ₽/мес).`,
  };
}
