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
  // Для CAPITAL взнос = 0 — это нормально, бюджет в порядке если капитал покрывает
  const capitalOk = selected.kind === "CAPITAL" && selected.feasible;
  const inMinus = !capitalOk && (remaining < -1 || surplus < -1);
  const budgetOk = capitalOk || !inMinus;

  let contributionAdvice = "";
  if (capitalOk) {
    contributionAdvice = "Дополнительный взнос не нужен — цель покрывается имеющимся капиталом.";
  } else if (inMinus) {
    contributionAdvice = surplus < -1
      ? `Бюджет в минусе на ${Math.round(Math.abs(surplus)).toLocaleString("ru-RU")} ₽/мес — сначала устраните дефицит.`
      : `Не хватает ≈ ${Math.round(Math.abs(remaining)).toLocaleString("ru-RU")} ₽/мес для этого пути.`;
  } else {
    contributionAdvice = `Нужно откладывать ≈ ${Math.round(required).toLocaleString("ru-RU")} ₽/мес (${selected.label}).`;
    if (selected.kind !== recommended) {
      const recLabel = selected.label; // will be overwritten below if needed
      void recLabel;
      contributionAdvice += ` Более выгодный путь: ${recommended}.`;
    }
  }

  let budgetAdvice = "";
  if (capitalOk) {
    budgetAdvice = `Капитал к сроку покрывает цель — дополнительных вложений не требуется.`;
  } else if (inMinus) {
    budgetAdvice = surplus < -1
      ? `Доходы меньше расходов на ≈ ${Math.round(Math.abs(surplus)).toLocaleString("ru-RU")} ₽/мес. Пока бюджет в минусе, копить на цель нельзя.`
      : `Не хватает ≈ ${Math.round(Math.abs(remaining)).toLocaleString("ru-RU")} ₽/мес. Увеличьте доход, сократите расходы или снизьте сумму цели.`;
  } else if (remaining > 100) {
    budgetAdvice = `После взноса на эту цель останется ≈ ${Math.round(remaining).toLocaleString("ru-RU")} ₽/мес свободных.`;
  } else {
    budgetAdvice = "Взнос на цель практически совпадает со свободным профицитом.";
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
 *
 * Ключевые принципы:
 * - SAVE/LOAN/HYBRID всегда показывают реальный взнос от нуля (amount / months),
 *   чтобы пользователь видел сколько нужно откладывать.
 * - funding.requiredMonthlyDesired отражает gap с учётом капитала — используем
 *   его для SAVE только если он больше нуля (иначе цель уже покрыта капиталом).
 * - CAPITAL feasible зависит только от наличия капитала, не от cashflow surplus.
 * - feasible проверяет availableSurplus (профицит без недостижимых целей).
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

  // Взнос для SAVE: всегда от полной суммы цели (информационно),
  // но если капитал уже частично покрывает — берём gap из движка.
  // Никогда не используем 0 как "нужный взнос" — если gap=0, CAPITAL будет рекомендован.
  const gapMonthly = args.funding?.requiredMonthlyDesired ?? 0;
  const rawMonthly = amount / months;
  // Если движок посчитал gap=0 (капитал покрывает), используем rawMonthly для
  // информационных вариантов SAVE/LOAN/HYBRID, иначе — реальный gap.
  const saveMonthly = gapMonthly > 0 ? gapMonthly : rawMonthly;

  const options: GoalPathOption[] = [];

  {
    const monthly = saveMonthly;
    const feasible = surplus + 1 >= monthly;
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
        ? `Откладывайте ≈ ${Math.round(monthly).toLocaleString("ru-RU")} ₽/мес на ${months} мес.`
        : "Профицита не хватает на нужный взнос",
    });
  }

  {
    const n = settings.loanTermMonths;
    const monthly = loanPayment(amount, settings.loanRatePct, n);
    const totalCost = monthly * n;
    const feasible = surplus + 1 >= monthly;
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
    const loanN = settings.loanTermMonths;
    const loanM = loanPayment(principal, settings.loanRatePct, loanN);
    const monthly = Math.max(saveM, loanM);
    const totalCost = saveM * months + loanM * loanN;
    const feasible = surplus + 1 >= monthly;
    options.push({
      kind: "HYBRID",
      label: "Часть копить, часть в кредит",
      monthlyOutflow: monthly,
      totalCost,
      months: months + loanN,
      feasible,
      score: feasible ? totalCost : totalCost + 1e12,
      note: `Сначала копите ${settings.downPaymentPct}% за ${months} мес., затем кредит на остаток ${loanN} мес.`,
    });
  }

  {
    // CAPITAL: feasible зависит только от капитала, не от cashflow
    const capitalFeasible = available + 1 >= amount;
    options.push({
      kind: "CAPITAL",
      label: "Из капитала",
      monthlyOutflow: 0,
      totalCost: amount,
      months: 0,
      feasible: capitalFeasible,
      score: capitalFeasible ? amount * 0.95 : amount + 1e12,
      note: capitalFeasible
        ? `К сроку цель покрывается капиталом (${Math.round(available).toLocaleString("ru-RU")} ₽ доступно)`
        : `Капитала недостаточно: есть ${Math.round(available).toLocaleString("ru-RU")} ₽, нужно ${Math.round(amount).toLocaleString("ru-RU")} ₽`,
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

export type GoalFix = {
  kind: "extend_term" | "reduce_amount" | "switch_path" | "reduce_priority";
  label: string;
  /** Human-readable suggestion */
  hint: string;
  /** Suggested new value (months / amount / kind), to pre-fill inputs */
  value?: number | GoalPathKind;
};

/**
 * Generates concrete "how to make this goal achievable" suggestions
 * for an unachievable goal.
 */
export function suggestFixesForGoal(args: {
  targetAmount: number;
  monthsToGoal: number;
  avgMonthlySurplus: number;
  funding?: GoalFundingResult;
  settings: GoalPathSettings;
  goalPriority?: number;
}): GoalFix[] {
  const { targetAmount, monthsToGoal, avgMonthlySurplus, funding, settings, goalPriority } = args;
  const surplus = avgMonthlySurplus;
  const fixes: GoalFix[] = [];

  if (surplus <= 0) {
    fixes.push({
      kind: "reduce_priority",
      label: "Исправьте бюджет",
      hint: "Доходы меньше расходов — сначала устраните дефицит бюджета, затем вернитесь к цели.",
    });
    return fixes;
  }

  // 1. Extend term: find months when the cheapest path becomes feasible
  const tryMonths = [
    monthsToGoal + 12,
    monthsToGoal + 24,
    monthsToGoal + 36,
    monthsToGoal + 60,
  ];
  for (const m of tryMonths) {
    const a = analyzeGoalPaths({ targetAmount, monthsToGoal: m, avgMonthlySurplus: surplus, funding, settings });
    if (a.budget.budgetOk) {
      const yrs = Math.round(m / 12);
      fixes.push({
        kind: "extend_term",
        label: `Сдвинуть срок на ${m - monthsToGoal} мес. (+${yrs > 0 ? yrs + " г." : ""})`,
        hint: `При сроке ${m} мес. нужный взнос (${Math.round(a.budget.requiredMonthly).toLocaleString("ru-RU")} ₽/мес) укладывается в бюджет.`,
        value: m,
      });
      break;
    }
  }

  // 2. Reduce amount: find target that fits current term
  const frac = surplus > 0 ? Math.min(1, surplus / ((funding?.requiredMonthlyDesired ?? targetAmount / monthsToGoal) || 1)) : 0;
  if (frac > 0.1 && frac < 0.99) {
    const reducedAmount = Math.round(targetAmount * frac * 0.95 / 1000) * 1000;
    if (reducedAmount > 0 && reducedAmount < targetAmount) {
      const a = analyzeGoalPaths({ targetAmount: reducedAmount, monthsToGoal, avgMonthlySurplus: surplus, funding: undefined, settings });
      if (a.budget.budgetOk) {
        fixes.push({
          kind: "reduce_amount",
          label: `Снизить сумму до ≈ ${reducedAmount.toLocaleString("ru-RU")} ₽`,
          hint: `При уменьшенной сумме взнос (${Math.round(a.budget.requiredMonthly).toLocaleString("ru-RU")} ₽/мес) укладывается в профицит.`,
          value: reducedAmount,
        });
      }
    }
  }

  // 3. Switch path: try LOAN / HYBRID if they are cheaper
  const altKinds: GoalPathKind[] = ["LOAN", "HYBRID", "SAVE"];
  for (const kind of altKinds) {
    if (kind === settings.preferredKind) continue;
    const a = analyzeGoalPaths({
      targetAmount, monthsToGoal, avgMonthlySurplus: surplus, funding,
      settings: { ...settings, preferredKind: kind },
    });
    if (a.budget.budgetOk) {
      const opt = a.options.find((o) => o.kind === kind);
      if (opt) {
        fixes.push({
          kind: "switch_path",
          label: `Сменить способ → «${opt.label}»`,
          hint: `${opt.label}: взнос ≈ ${Math.round(opt.monthlyOutflow).toLocaleString("ru-RU")} ₽/мес — влезает в бюджет.`,
          value: kind,
        });
        break;
      }
    }
  }

  // 4. If priority > 1, suggest reducing it (free up more surplus)
  if ((goalPriority ?? 1) > 1) {
    fixes.push({
      kind: "reduce_priority",
      label: "Повысить приоритет цели",
      hint: "Если поставить эту цель первой — больше профицита будет распределено на неё до других целей.",
    });
  }

  if (fixes.length === 0) {
    fixes.push({
      kind: "reduce_priority",
      label: "Увеличьте доход или сократите расходы",
      hint: `Не хватает ≈ ${Math.round(Math.max(0, (funding?.requiredMonthlyMin ?? 0) - surplus)).toLocaleString("ru-RU")} ₽/мес. Скорректируйте бюджет в разделе «Данные».`,
    });
  }

  return fixes;
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

/**
 * Профицит, доступный цели после взносов более приоритетных **достижимых** целей.
 * Недостижимые цели (achievability === "none") не занимают бюджет — они "вне игры"
 * до тех пор, пока пользователь не выберет вариант их достижения.
 *
 * Вычитается реальный ежемесячный взнос по выбранному пути (SAVE/LOAN/HYBRID),
 * а не gap из движка (который может быть 0 если капитал уже покрывает цель).
 */
export function surplusAvailableForGoal(
  goalId: string,
  goals: Array<{
    id: string;
    targetAmountNominal: number;
    priority?: number | null;
    pathSettings?: Partial<GoalPathSettings> | null;
  }>,
  funding: Record<string, GoalFundingResult | undefined>,
  surplusMonthly: number,
): number {
  const sorted = [...goals].sort(
    (a, b) => (a.priority ?? 1) - (b.priority ?? 1),
  );
  let remaining = surplusMonthly;
  for (const g of sorted) {
    if (g.id === goalId) return remaining;
    const f = funding[g.id];
    // Недостижимые цели не расходуют бюджет других целей
    if (!f || f.achievability === "none") continue;
    // Считаем реальный взнос по выбранному пути для этой цели
    const a = analyzeGoalPaths({
      targetAmount: g.targetAmountNominal,
      monthsToGoal: f.monthsToGoal,
      avgMonthlySurplus: remaining,
      funding: f,
      settings: g.pathSettings,
    });
    // CAPITAL не требует ежемесячного взноса из cashflow
    const outflow = a.selectedKind === "CAPITAL" ? 0 : a.budget.requiredMonthly;
    remaining = Math.max(0, remaining - outflow);
  }
  return remaining;
}
