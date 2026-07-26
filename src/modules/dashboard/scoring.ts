import type { DashboardMetrics, HomeDashboardInput } from "@/modules/dashboard/insights";
import { computeDashboardMetrics } from "@/modules/dashboard/insights";
import type { Asset, Goal } from "@/shared/types";

export type ScoreBlockId = "wealth" | "budget" | "planning" | "investments";

export type ScoreGradeId =
  | "perfect"
  | "strong"
  | "adequate"
  | "developing"
  | "weak"
  | "critical";

export type ScoreFactor = {
  id: string;
  label: string;
  /** 0–100 */
  value: number;
  /** Weight within the block, 0–1 */
  weight: number;
  explanation: string;
};

export type ScoreBlock = {
  id: ScoreBlockId;
  label: string;
  description: string;
  /** 0–100 */
  score: number;
  factors: ScoreFactor[];
};

export type ScoreGrade = {
  id: ScoreGradeId;
  label: string;
  range: string;
  meaning: string;
};

export type ScoreStatus = "empty" | "incomplete" | "stale" | "ready";

export type ScoreMissingStep = "balance" | "cashflow" | "goals";

export type FinancialScore = {
  /** 0–100; null если данных нет (status empty) */
  total: number | null;
  grade: ScoreGrade | null;
  summary: string;
  debtHeavy: boolean;
  blocks: ScoreBlock[];
  status: ScoreStatus;
  missingSteps: ScoreMissingStep[];
  /** Сколько дней с последнего обновления сущностей; null если дат нет */
  staleDays: number | null;
  /** Короткий призыв к действию */
  cta: string;
};

export type ScoringExtras = {
  goals?: Pick<Goal, "linkedAssetId" | "goalType">[];
  assets?: Pick<Asset, "type" | "assetClass" | "portfolioHoldings">[];
  /** Avg monthly cashflow from plan projection; null/undefined → neutral */
  projectionCashflowAvg?: number | null;
  /** Latest entity update; if omitted, derived from entity updatedAt when available */
  lastUpdated?: Date | string | null;
};

export const SCORE_STALE_AFTER_DAYS = 30;

const STEP_LABEL: Record<ScoreMissingStep, string> = {
  balance: "Баланс (активы/пассивы)",
  cashflow: "Поток (доходы и расходы)",
  goals: "Цели",
};

const BLOCK_CTA: Record<ScoreBlockId, string> = {
  wealth: "Заполните активы и пассивы во вкладке «Баланс».",
  budget: "Добавьте доходы и расходы во вкладке «Поток».",
  planning: "Добавьте цели и заполните баланс с потоком.",
  investments: "Добавьте инвестиционные активы и привяжите их к целям.",
};

function clamp(n: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, n));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function weightedScore(factors: ScoreFactor[]): number {
  const sum = factors.reduce((s, f) => s + f.value * f.weight, 0);
  return clamp(round1(sum));
}

export function scoreGrade(total: number): ScoreGrade {
  if (total >= 90) {
    return {
      id: "perfect",
      label: "CFP Perfect",
      range: "90–100",
      meaning: "Сильное финансовое состояние и полное планирование.",
    };
  }
  if (total >= 75) {
    return {
      id: "strong",
      label: "CFP Strong",
      range: "75–89",
      meaning: "Хорошее состояние: есть план, цели и диверсификация.",
    };
  }
  if (total >= 60) {
    return {
      id: "adequate",
      label: "CFP Adequate",
      range: "60–74",
      meaning: "Устойчивое состояние, но есть зоны для улучшения.",
    };
  }
  if (total >= 45) {
    return {
      id: "developing",
      label: "CFP Developing",
      range: "45–59",
      meaning: "Начальный уровень зрелости, много пробелов.",
    };
  }
  if (total >= 30) {
    return {
      id: "weak",
      label: "CFP Weak",
      range: "30–44",
      meaning: "Слабый уровень: нет системы или цели труднодостижимы.",
    };
  }
  return {
    id: "critical",
    label: "CFP Critical",
    range: "0–29",
    meaning: "Критический уровень: долги, дефицит или нет планирования.",
  };
}

/** Liquidity score 0–100; optimum share 20–50%. */
function liquidityScore(liquidShare: number): number {
  if (liquidShare < 0.2) return clamp((liquidShare / 0.2) * 100);
  if (liquidShare <= 0.5) return 100;
  return clamp(100 * (1 - (liquidShare - 0.5) / 0.5));
}

/** Expected yield score 0–100; optimum 5–15% p.a. */
function yieldScore(yieldPct: number): number {
  const y = yieldPct / 100;
  if (y < 0.03) return 0;
  if (y < 0.05) return clamp((y / 0.05) * 50);
  if (y <= 0.15) return clamp(50 + ((y - 0.05) / 0.1) * 50);
  return 100;
}

/** KDR (income/expense) → 0–100. */
function kdrScore(kdr: number): number {
  if (!Number.isFinite(kdr) || kdr <= 0) return 0;
  const norm = Math.min(2, Math.max(0.5, kdr));
  // Methodology: 100 × (norm - 1) / norm → map to 0–100 scale of the factor
  return clamp(100 * ((norm - 1) / norm));
}

/** Portfolio vol proxy: sweet spot ~8–18%. */
function volRiskScore(volPct: number, hasInvest: boolean): number {
  if (!hasInvest) return 40;
  if (volPct <= 0) return 50;
  if (volPct >= 8 && volPct <= 18) return 100;
  if (volPct < 8) return clamp(40 + (volPct / 8) * 60);
  // > 18: decay toward 40 at 40%
  if (volPct >= 40) return 40;
  return clamp(100 - ((volPct - 18) / 22) * 60);
}

function sleeveOrTypeCount(assets: ScoringExtras["assets"], fallbackTypes: number): number {
  if (!assets || assets.length === 0) return fallbackTypes;
  const sleeves = new Set<string>();
  for (const a of assets) {
    if (a.portfolioHoldings && a.portfolioHoldings.length > 0) {
      for (const h of a.portfolioHoldings) sleeves.add(h.sleeve);
    } else {
      sleeves.add(a.type);
    }
  }
  return sleeves.size;
}

function computeWealth(m: DashboardMetrics): ScoreBlock {
  const ko = m.debtRatio;
  const koPts = clamp(100 * (1 - Math.min(1, Math.max(0, ko))));
  const liqPts = liquidityScore(m.liquidShare);

  let yieldPct = 0;
  if (m.investTotal > 0) {
    const divYield = ((m.dividendMonthly * 12) / m.investTotal) * 100;
    // Blend expected capital return on all assets weighted toward invest share
    yieldPct = m.weightedReturnPct * (m.investShare > 0 ? 1 : 0) + divYield * 0.5;
    if (m.investShare > 0) {
      // Prefer invest-weighted expected return already in metrics when invest exists
      yieldPct = m.weightedReturnPct + divYield * 0.35;
    }
  }
  const yPts = m.investTotal > 0 ? yieldScore(yieldPct) : 35;

  const factors: ScoreFactor[] = [
    {
      id: "ko",
      label: "Коэффициент обязательств",
      value: round1(koPts),
      weight: 0.5,
      explanation: `КО = ${(ko * 100).toFixed(0)}%. Чем ниже доля долгов в активах, тем выше балл.`,
    },
    {
      id: "liquidity",
      label: "Ликвидность",
      value: round1(liqPts),
      weight: 0.25,
      explanation: `Доля ликвидных счетов ${(m.liquidShare * 100).toFixed(0)}%. Оптимум 20–50% капитала.`,
    },
    {
      id: "yield",
      label: "Доходность активов",
      value: round1(yPts),
      weight: 0.25,
      explanation:
        m.investTotal > 0
          ? `Ожидаемая доходность инвест-активов ≈ ${yieldPct.toFixed(1)}% годовых. Оптимум 5–15%.`
          : "Инвест-активов пока нет — нейтральная оценка. Добавьте портфель в балансе.",
    },
  ];

  return {
    id: "wealth",
    label: "Благосостояние",
    description:
      "Текущее положение: долги, подушка ликвидности и работающие активы.",
    score: weightedScore(factors),
    factors,
  };
}

function computeBudget(
  m: DashboardMetrics,
  projectionCashflowAvg?: number | null,
): ScoreBlock {
  const kdrPts = kdrScore(m.kdr);

  const withLimits = m.envelopes.filter((e) => e.monthlyLimit != null && e.monthlyLimit > 0);
  let planPts = 50;
  if (withLimits.length > 0) {
    const avg = withLimits.reduce((s, e) => {
      const lim = e.monthlyLimit as number;
      const match = 1 - Math.abs(e.plannedMonthly - lim) / lim;
      return s + Math.min(1, Math.max(0, match));
    }, 0) / withLimits.length;
    planPts = clamp(avg * 100);
  } else if (m.hasExpense) {
    planPts = 45;
  }

  const canSave =
    m.expenseMonthly > 0 && m.surplusMonthly > 0.1 * m.expenseMonthly;
  const savePts = canSave ? 100 : m.surplusMonthly > 0 ? 40 : 0;

  let futurePts = 50;
  let futureExplain =
    "Прогноз потоков ещё не учтён — нейтральная оценка. Откройте вкладку «План».";
  if (projectionCashflowAvg != null && Number.isFinite(projectionCashflowAvg)) {
    if (m.expenseMonthly > 0) {
      const norm = Math.min(1, Math.max(0, projectionCashflowAvg / m.expenseMonthly));
      futurePts = clamp(norm * 100);
      futureExplain = `Средний прогнозный остаток ${projectionCashflowAvg.toFixed(0)} ₽/мес относительно расходов.`;
    } else {
      futurePts = projectionCashflowAvg > 0 ? 80 : 40;
      futureExplain = `Средний прогнозный cashflow ${projectionCashflowAvg.toFixed(0)} ₽/мес.`;
    }
  }

  const factors: ScoreFactor[] = [
    {
      id: "kdr",
      label: "КДР (доход / расход)",
      value: round1(kdrPts),
      weight: 0.35,
      explanation: `КДР = ${m.kdr === 99 ? "∞" : m.kdr.toFixed(2)}. Выше 1 — живёте в рамках доходов.`,
    },
    {
      id: "plan-match",
      label: "Соответствие плану",
      value: round1(planPts),
      weight: 0.3,
      explanation:
        withLimits.length > 0
          ? `Сверка расходов с лимитами конвертов (${withLimits.length} кат.).`
          : "Лимиты конвертов не заданы — задайте их во вкладке «Поток».",
    },
    {
      id: "can-save",
      label: "Можно откладывать",
      value: savePts,
      weight: 0.15,
      explanation: canSave
        ? "Профицит больше 10% расходов — есть запас на накопления."
        : "Профицит мал или отрицателен — сначала выровняйте поток.",
    },
    {
      id: "future",
      label: "Будущие потоки",
      value: round1(futurePts),
      weight: 0.2,
      explanation: futureExplain,
    },
  ];

  return {
    id: "budget",
    label: "Бюджет",
    description:
      "Качество денежного потока: профицит, дисциплина расходов и устойчивость.",
    score: weightedScore(factors),
    factors,
  };
}

function computePlanning(
  m: DashboardMetrics,
  goals: ScoringExtras["goals"],
): ScoreBlock {
  const list = goals ?? [];
  const hasPlan = m.hasAssets && m.hasIncome && m.hasExpense;
  const hasGoals = m.hasGoals || list.length > 0;
  const linkedShare =
    list.length > 0
      ? list.filter((g) => g.linkedAssetId).length / list.length
      : 0;
  const scenarioBonus = m.hasScenarios ? 1 : 0;

  const presenceNorm =
    (hasPlan ? 0.4 : 0) +
    (hasGoals ? 0.35 : 0) +
    linkedShare * 0.15 +
    scenarioBonus * 0.1;
  const presencePts = clamp(presenceNorm * 100);

  let achievePts = 40;
  let achieveExplain = "Мало данных о достижимости целей.";
  if (m.avgGoalProbability != null) {
    achievePts = clamp(m.avgGoalProbability * 100);
    achieveExplain = `Средняя вероятность целей ${(m.avgGoalProbability * 100).toFixed(0)}% (Monte Carlo).`;
  } else if (m.goalsFundable === true) {
    achievePts = 75;
    achieveExplain = "Цели выглядят финансируемыми при текущем профиците.";
  } else if (m.goalsFundable === false) {
    achievePts = 25;
    achieveExplain = "Текущего профицита недостаточно для целей.";
  } else if (!hasGoals) {
    achievePts = 20;
    achieveExplain = "Целей пока нет — добавьте хотя бы одну.";
  }

  const progressShare =
    list.length > 0
      ? linkedShare
      : m.avgGoalProbability != null
        ? m.avgGoalProbability
        : hasGoals
          ? 0.35
          : 0;
  const progressPts = clamp(progressShare * 100);

  const retirementGoals = list.filter((g) => g.goalType === "RETIREMENT");
  let pensionPts = 25;
  let pensionExplain =
    "Пенсионной цели нет — нейтральная оценка. Добавьте цель типа «Пенсия».";
  if (retirementGoals.length > 0) {
    const linked = retirementGoals.some((g) => g.linkedAssetId);
    pensionPts = linked ? 80 : 55;
    if (m.avgGoalProbability != null) {
      pensionPts = clamp(40 + m.avgGoalProbability * 60);
    }
    pensionExplain = linked
      ? "Есть пенсионная цель, привязанная к активу."
      : "Есть пенсионная цель — привяжите накопительный актив.";
  }

  const factors: ScoreFactor[] = [
    {
      id: "presence",
      label: "Наличие плана и целей",
      value: round1(presencePts),
      weight: 0.25,
      explanation: `План: ${hasPlan ? "да" : "нет"}, цели: ${hasGoals ? "да" : "нет"}, привязка ${(linkedShare * 100).toFixed(0)}%, сценарии: ${m.hasScenarios ? "да" : "нет"}.`,
    },
    {
      id: "achievability",
      label: "Достижимость целей",
      value: round1(achievePts),
      weight: 0.3,
      explanation: achieveExplain,
    },
    {
      id: "progress",
      label: "Движение по плану",
      value: round1(progressPts),
      weight: 0.25,
      explanation:
        list.length > 0
          ? `Доля целей с привязанным активом ${(linkedShare * 100).toFixed(0)}%.`
          : "Привяжите цели к активам и следите за прогрессом в плане.",
    },
    {
      id: "pension",
      label: "Пенсионное планирование",
      value: round1(pensionPts),
      weight: 0.2,
      explanation: pensionExplain,
    },
  ];

  return {
    id: "planning",
    label: "Планирование",
    description:
      "Есть ли стратегия: цели, привязка к активам, пенсия и сценарии.",
    score: weightedScore(factors),
    factors,
  };
}

function computeInvestments(
  m: DashboardMetrics,
  extras: ScoringExtras,
): ScoreBlock {
  const count = sleeveOrTypeCount(extras.assets, m.assetClassCount);
  const divNorm = Math.min(1, count / 5);
  const divPts = clamp(divNorm * 100);

  const riskPts = volRiskScore(m.weightedVolPct, m.investTotal > 0);

  const goals = extras.goals ?? [];
  const linkNorm =
    goals.length > 0
      ? goals.filter((g) => g.linkedAssetId).length / goals.length
      : m.hasGoals
        ? 0
        : 0.5;
  const linkPts = clamp(linkNorm * 100);

  const ko = m.debtRatio;
  const expectedShare = 0.3 * (1 - Math.min(1, Math.max(0, ko)));
  let sharePts = 40;
  let shareExplain =
    "Инвест-доля оценивается относительно ожидаемой доли капитала.";
  if (expectedShare <= 0) {
    sharePts = m.investShare <= 0.05 ? 70 : 40;
    shareExplain = "При высокой долговой нагрузке приоритет — снижение долгов, не наращивание портфеля.";
  } else {
    const corr = Math.min(1, m.investShare / expectedShare);
    sharePts = clamp(corr * 100);
    shareExplain = `Доля инвестиций ${(m.investShare * 100).toFixed(0)}% при ориентире ~${(expectedShare * 100).toFixed(0)}%.`;
  }

  const factors: ScoreFactor[] = [
    {
      id: "diversification",
      label: "Диверсификация",
      value: round1(divPts),
      weight: 0.3,
      explanation: `Классов/sleeve: ${count} из 5 желаемых.`,
    },
    {
      id: "risk",
      label: "Риск портфеля",
      value: round1(riskPts),
      weight: 0.2,
      explanation:
        m.investTotal > 0
          ? `Взвешенная волатильность ≈ ${m.weightedVolPct.toFixed(1)}%. Комфортный коридор 8–18%.`
          : "Портфеля нет — нейтрально-низкая оценка риска.",
    },
    {
      id: "goal-link",
      label: "Привязка к целям",
      value: round1(linkPts),
      weight: 0.25,
      explanation:
        goals.length > 0
          ? `Целей с привязанным активом: ${goals.filter((g) => g.linkedAssetId).length} из ${goals.length}.`
          : "Нет целей или привязок — инвестиции не связаны с планом.",
    },
    {
      id: "invest-share",
      label: "Доля инвестиций",
      value: round1(sharePts),
      weight: 0.25,
      explanation: shareExplain,
    },
  ];

  return {
    id: "investments",
    label: "Инвестиции",
    description:
      "Насколько портфель диверсифицирован, уместен по риску и связан с целями.",
    score: weightedScore(factors),
    factors,
  };
}

function toTime(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Max updatedAt across finance entities. */
export function latestEntityUpdate(
  entities: Array<{ updatedAt?: Date | string | null }>,
): Date | null {
  let max = 0;
  for (const e of entities) {
    const t = toTime(e.updatedAt ?? null);
    if (t != null && t > max) max = t;
  }
  return max > 0 ? new Date(max) : null;
}

export function resolveScoreReadiness(
  metrics: DashboardMetrics,
  lastUpdated: Date | string | null | undefined,
  now = new Date(),
): Pick<
  FinancialScore,
  "status" | "missingSteps" | "staleDays" | "cta"
> {
  const missingSteps: ScoreMissingStep[] = [];
  if (!metrics.step1) missingSteps.push("balance");
  if (!metrics.step2) missingSteps.push("cashflow");
  if (!metrics.step3) missingSteps.push("goals");

  if (missingSteps.length === 3) {
    return {
      status: "empty",
      missingSteps,
      staleDays: null,
      cta: "Заполните Баланс, Поток и Цели — после этого появится финансовый скоринг.",
    };
  }

  if (missingSteps.length > 0) {
    const names = missingSteps.map((s) => STEP_LABEL[s]).join(", ");
    return {
      status: "incomplete",
      missingSteps,
      staleDays: null,
      cta: `Данных недостаточно — внесите: ${names}. Иначе скоринг неверен.`,
    };
  }

  const updatedMs = toTime(lastUpdated);
  if (updatedMs == null) {
    return {
      status: "ready",
      missingSteps: [],
      staleDays: null,
      cta: "",
    };
  }

  const staleDays = Math.floor(
    (now.getTime() - updatedMs) / (1000 * 60 * 60 * 24),
  );
  if (staleDays > SCORE_STALE_AFTER_DAYS) {
    return {
      status: "stale",
      missingSteps: [],
      staleDays,
      cta: `Данные не обновлялись ${staleDays} дн. — обновите баланс и поток, иначе оценка занижена.`,
    };
  }

  return {
    status: "ready",
    missingSteps: [],
    staleDays,
    cta: "",
  };
}

/** Penalty multiplier for stale data: after 30d decays toward 0.4 over ~90d. */
export function staleScoreMultiplier(staleDays: number): number {
  if (staleDays <= SCORE_STALE_AFTER_DAYS) return 1;
  return Math.max(0.4, 1 - (staleDays - SCORE_STALE_AFTER_DAYS) / 90);
}

export function blockCta(blockId: ScoreBlockId, score: FinancialScore): string {
  if (score.status === "ready") return "";
  if (score.status === "empty") return BLOCK_CTA[blockId];
  if (score.status === "stale") return score.cta;
  // incomplete: prefer step-specific + general
  const stepForBlock: Partial<Record<ScoreBlockId, ScoreMissingStep>> = {
    wealth: "balance",
    budget: "cashflow",
    planning: "goals",
  };
  const step = stepForBlock[blockId];
  if (step && score.missingSteps.includes(step)) {
    return BLOCK_CTA[blockId];
  }
  return score.cta;
}

export function computeFinancialScore(
  metrics: DashboardMetrics,
  extras: ScoringExtras = {},
): FinancialScore {
  const wealth = computeWealth(metrics);
  const budget = computeBudget(metrics, extras.projectionCashflowAvg);
  const planning = computePlanning(metrics, extras.goals);
  const investments = computeInvestments(metrics, extras);
  const blocks = [wealth, budget, planning, investments];

  const debtHeavy = metrics.debtRatio > 0.5;
  const readiness = resolveScoreReadiness(metrics, extras.lastUpdated ?? null);

  if (readiness.status === "empty") {
    return {
      total: null,
      grade: null,
      summary: "Недостаточно данных для расчёта скоринга.",
      debtHeavy: false,
      blocks,
      ...readiness,
    };
  }

  const w = debtHeavy
    ? { wealth: 0.3, budget: 0.25, planning: 0.3, investments: 0.15 }
    : { wealth: 0.25, budget: 0.25, planning: 0.3, investments: 0.2 };

  let total = clamp(
    round1(
      wealth.score * w.wealth +
        budget.score * w.budget +
        planning.score * w.planning +
        investments.score * w.investments,
    ),
  );

  let summary = debtHeavy
    ? "Высокая долговая нагрузка: в общем балле усилен вес благосостояния, инвестиции ослаблены."
    : "Общий балл — взвешенная сумма благосостояния, бюджета, планирования и инвестиций.";

  if (readiness.status === "stale" && readiness.staleDays != null) {
    total = clamp(
      round1(total * staleScoreMultiplier(readiness.staleDays)),
    );
    summary = readiness.cta;
  } else if (readiness.status === "incomplete") {
    summary = readiness.cta;
  }

  return {
    total,
    grade: scoreGrade(total),
    summary,
    debtHeavy,
    blocks,
    ...readiness,
  };
}

/** Convenience: metrics from home input + optional extras. */
export function scoreFromHomeInput(
  input: HomeDashboardInput,
  extras: ScoringExtras = {},
): FinancialScore {
  const metrics = computeDashboardMetrics(input);
  const lastUpdated =
    extras.lastUpdated ??
    latestEntityUpdate([
      ...input.assets,
      ...input.liabilities,
      ...input.incomes,
      ...input.expenses,
      ...input.goals,
    ]);
  return computeFinancialScore(metrics, {
    goals: extras.goals ?? input.goals,
    assets: extras.assets ?? input.assets,
    projectionCashflowAvg: extras.projectionCashflowAvg,
    lastUpdated,
  });
}

export function getScoreBlock(
  score: FinancialScore,
  id: ScoreBlockId,
): ScoreBlock {
  return score.blocks.find((b) => b.id === id) ?? score.blocks[0];
}
