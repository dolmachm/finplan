import { monthlyEquivalent } from "@/modules/plan/frequency";
import type {
  Asset,
  BudgetCategory,
  Expense,
  Goal,
  Income,
  Liability,
} from "@/shared/types";
import type { PlanFrequency } from "@/modules/plan/frequency";
import { formatRub } from "@/shared/format";
import {
  envelopeOverviewSummary,
  type EnvelopeStatus,
} from "@/modules/budget/envelopes";

const LIQUID_TYPES = new Set(["CASH", "BANK_ACCOUNT", "DEPOSIT"]);

export type InsightSeverity = "critical" | "warning" | "positive" | "info";
export type DashboardCta = "assets" | "plan" | "export";

export type DashboardInsight = {
  id: string;
  kind: "insight" | "recommendation";
  severity: InsightSeverity;
  title: string;
  body: string;
  ctaTab?: DashboardCta;
  ctaLabel?: string;
};

export type DashboardMetrics = {
  assetsTotal: number;
  liabilitiesTotal: number;
  netWorth: number;
  incomeMonthly: number;
  expenseMonthly: number;
  surplusMonthly: number;
  liquidTotal: number;
  investTotal: number;
  debtServiceMonthly: number;
  dividendMonthly: number;
  weightedReturnPct: number;
  weightedVolPct: number;
  maxAssetShare: number;
  assetClassCount: number;
  cushionMonths: number;
  debtRatio: number;
  debtServiceRatio: number;
  kdr: number;
  liquidShare: number;
  investShare: number;
  savingsRate: number;
  recommendedMonthlySaving: number;
  goalsFundable: boolean | null;
  avgGoalProbability: number | null;
  hasAssets: boolean;
  hasLiabilities: boolean;
  hasIncome: boolean;
  hasExpense: boolean;
  hasGoals: boolean;
  hasScenarios: boolean;
  step1: boolean;
  step2: boolean;
  step3: boolean;
  completenessPct: number;
  envelopeOverspent: Array<{
    name: string;
    plannedMonthly: number;
    monthlyLimit: number;
  }>;
  envelopes: EnvelopeStatus[];
  envelopePlannedTotal: number;
  envelopeLimitTotal: number;
  envelopeOverspentCount: number;
};

export type HomeDashboardInput = {
  assets: Asset[];
  liabilities: Liability[];
  incomes: Income[];
  expenses: Expense[];
  goals: Goal[];
  scenarioCount: number;
  budgetCategories?: BudgetCategory[];
  recommendedMonthlySaving?: number;
  goalProbabilities?: Array<{ probability: number }>;
};

function freq(amount: number, frequency: string) {
  return monthlyEquivalent(amount, frequency as PlanFrequency);
}

export function computeDashboardMetrics(
  input: HomeDashboardInput,
): DashboardMetrics {
  const {
    assets,
    liabilities,
    incomes,
    expenses,
    goals,
    scenarioCount,
    budgetCategories = [],
    recommendedMonthlySaving = 0,
    goalProbabilities,
  } = input;

  const assetsTotal = assets.reduce((s, a) => s + a.currentValue, 0);
  const liabilitiesTotal = liabilities.reduce(
    (s, l) => s + l.remainingBalance,
    0,
  );
  const incomeMonthly = incomes.reduce(
    (s, i) => s + freq(i.amount, i.frequency),
    0,
  );
  const expenseMonthly = expenses.reduce(
    (s, e) => s + freq(e.amount, e.frequency),
    0,
  );
  const surplusMonthly = incomeMonthly - expenseMonthly;
  const liquidTotal = assets
    .filter((a) => LIQUID_TYPES.has(a.type))
    .reduce((s, a) => s + a.currentValue, 0);
  const investTotal = assets
    .filter((a) => a.assetClass === "INVESTMENT")
    .reduce((s, a) => s + a.currentValue, 0);
  const debtServiceMonthly = liabilities.reduce(
    (s, l) => s + l.monthlyPayment,
    0,
  );
  const dividendMonthly = assets.reduce(
    (s, a) => s + (a.dividendIncomeMonthly ?? 0),
    0,
  );

  let wRet = 0;
  let wVol = 0;
  let maxAssetShare = 0;
  if (assetsTotal > 0) {
    for (const a of assets) {
      const share = a.currentValue / assetsTotal;
      wRet += share * a.expectedReturnPct;
      wVol += share * a.volatilityPct;
      if (share > maxAssetShare) maxAssetShare = share;
    }
  }

  const types = new Set(assets.map((a) => a.type));
  const cushionMonths =
    expenseMonthly > 0 ? liquidTotal / expenseMonthly : liquidTotal > 0 ? 99 : 0;
  const debtRatio = assetsTotal > 0 ? liabilitiesTotal / assetsTotal : liabilitiesTotal > 0 ? 1 : 0;
  const debtServiceRatio =
    incomeMonthly > 0 ? debtServiceMonthly / incomeMonthly : 0;
  const kdr = expenseMonthly > 0 ? incomeMonthly / expenseMonthly : incomeMonthly > 0 ? 99 : 0;
  const liquidShare = assetsTotal > 0 ? liquidTotal / assetsTotal : 0;
  const investShare = assetsTotal > 0 ? investTotal / assetsTotal : 0;
  const savingsRate =
    incomeMonthly > 0 ? surplusMonthly / incomeMonthly : 0;

  let goalsFundable: boolean | null = null;
  if (goals.length > 0 && recommendedMonthlySaving > 0) {
    goalsFundable =
      surplusMonthly <= 0
        ? false
        : (recommendedMonthlySaving - surplusMonthly) / Math.max(surplusMonthly, 1) <= 0.2;
  } else if (goals.length > 0 && recommendedMonthlySaving === 0) {
    goalsFundable = true;
  }

  const avgGoalProbability =
    goalProbabilities && goalProbabilities.length > 0
      ? goalProbabilities.reduce((s, g) => s + g.probability, 0) /
        goalProbabilities.length
      : null;

  const hasAssets = assets.length > 0;
  const hasLiabilities = liabilities.length > 0;
  const hasIncome = incomes.length > 0;
  const hasExpense = expenses.length > 0;
  const hasGoals = goals.length > 0;
  const step1 = hasAssets || hasLiabilities;
  const step2 = hasIncome && hasExpense;
  const step3 = hasGoals;
  const completenessPct = Math.round(
    ((step1 ? 1 : 0) + (step2 ? 1 : 0) + (step3 ? 1 : 0)) / 3 * 100,
  );

  const envelopeSummary = envelopeOverviewSummary(expenses, budgetCategories);
  const envelopeOverspent = envelopeSummary.statuses
    .filter((e) => e.overspent && e.monthlyLimit != null)
    .map((e) => ({
      name: e.name,
      plannedMonthly: e.plannedMonthly,
      monthlyLimit: e.monthlyLimit as number,
    }));

  return {
    assetsTotal,
    liabilitiesTotal,
    netWorth: assetsTotal - liabilitiesTotal,
    incomeMonthly,
    expenseMonthly,
    surplusMonthly,
    liquidTotal,
    investTotal,
    debtServiceMonthly,
    dividendMonthly,
    weightedReturnPct: wRet,
    weightedVolPct: wVol,
    maxAssetShare,
    assetClassCount: types.size,
    cushionMonths,
    debtRatio,
    debtServiceRatio,
    kdr,
    liquidShare,
    investShare,
    savingsRate,
    recommendedMonthlySaving,
    goalsFundable,
    avgGoalProbability,
    hasAssets,
    hasLiabilities,
    hasIncome,
    hasExpense,
    hasGoals,
    hasScenarios: scenarioCount > 0,
    step1,
    step2,
    step3,
    completenessPct,
    envelopeOverspent,
    envelopes: envelopeSummary.statuses,
    envelopePlannedTotal: envelopeSummary.plannedTotal,
    envelopeLimitTotal: envelopeSummary.limitTotal,
    envelopeOverspentCount: envelopeSummary.overspentCount,
  };
}

function push(
  list: DashboardInsight[],
  item: DashboardInsight,
  limit = 12,
) {
  if (list.length < limit) list.push(item);
}

export function buildInsights(
  m: DashboardMetrics,
): DashboardInsight[] {
  const insights: DashboardInsight[] = [];
  const recs: DashboardInsight[] = [];

  // ——— Onboarding / completeness ———
  if (!m.step1) {
    push(recs, {
      id: "rec-point0",
      kind: "recommendation",
      severity: "critical",
      title: "Зафиксируйте точку 0",
      body: "Добавьте активы и пассивы — это стартовый баланс для всех расчётов.",
      ctaTab: "assets",
      ctaLabel: "К данным",
    });
  }
  if (m.step1 && !m.step2) {
    push(recs, {
      id: "rec-cashflow",
      kind: "recommendation",
      severity: "warning",
      title: "Добавьте доходы и расходы",
      body: "Без денежного потока нельзя оценить профицит и посильность целей.",
      ctaTab: "assets",
      ctaLabel: "К данным",
    });
  }
  if (m.step2 && !m.step3) {
    push(recs, {
      id: "rec-goals",
      kind: "recommendation",
      severity: "warning",
      title: "Цели не заполнены",
      body: "Укажите финансовые цели, чтобы план и Monte Carlo имели смысл.",
      ctaTab: "assets",
      ctaLabel: "К целям",
    });
  }

  if (m.envelopeOverspent.length > 0) {
    const top = m.envelopeOverspent[0]!;
    const extra =
      m.envelopeOverspent.length > 1
        ? ` и ещё ${m.envelopeOverspent.length - 1}`
        : "";
    push(insights, {
      id: "insight-envelope-over",
      kind: "insight",
      severity: "warning",
      title: "Перерасход по конвертам",
      body: `«${top.name}»: запланировано ${formatRub(top.plannedMonthly)}/мес при лимите ${formatRub(top.monthlyLimit)}${extra}. Скорректируйте расходы или лимиты.`,
      ctaTab: "assets",
      ctaLabel: "К данным",
    });
  }
  if (m.step1 && m.step2 && m.step3) {
    push(recs, {
      id: "rec-profile-ok",
      kind: "recommendation",
      severity: "positive",
      title: "Базовый профиль собран",
      body: "Точка 0, cashflow и цели на месте — можно смотреть прогноз и риск.",
      ctaTab: "plan",
      ctaLabel: "К плану",
    });
  }

  // ——— Budget / surplus ———
  if (m.hasIncome && m.hasExpense) {
    if (m.surplusMonthly <= 0) {
      push(insights, {
        id: "ins-deficit",
        kind: "insight",
        severity: "critical",
        title: "Расходы не ниже доходов",
        body: `Месячный баланс ${formatRub(m.surplusMonthly)}. Пока нет профицита, копить на цели сложно.`,
        ctaTab: "assets",
      });
      push(recs, {
        id: "rec-kdr-low",
        kind: "recommendation",
        severity: "critical",
        title: "Дефицит бюджета (КДР < 1)",
        body: "Сократите расходы или увеличьте доход, цель — профицит от 10–20%.",
        ctaTab: "assets",
      });
    } else if (m.kdr < 1.2) {
      push(recs, {
        id: "rec-kdr-tight",
        kind: "recommendation",
        severity: "warning",
        title: "Небольшой профицит",
        body: `КДР ≈ ${m.kdr.toFixed(2)}. Усильте остаток до 1.3–1.5 для запаса и инвестиций.`,
        ctaTab: "assets",
      });
    } else if (m.kdr >= 1.5) {
      push(insights, {
        id: "ins-strong-surplus",
        kind: "insight",
        severity: "positive",
        title: "Сильный профицит",
        body: `КДР ≈ ${m.kdr.toFixed(2)}, остаток ${formatRub(m.surplusMonthly)}/мес — хороший запас для целей.`,
      });
      push(recs, {
        id: "rec-deploy-surplus",
        kind: "recommendation",
        severity: "positive",
        title: "Направьте избыток в план",
        body: "Используйте профицит для взносов по целям и инвест-плана.",
        ctaTab: "plan",
        ctaLabel: "Инвест-план",
      });
    } else {
      push(recs, {
        id: "rec-kdr-ok",
        kind: "recommendation",
        severity: "positive",
        title: "Хороший профицит",
        body: `Остаток ${formatRub(m.surplusMonthly)}/мес (≈ ${(m.savingsRate * 100).toFixed(0)}% дохода). Сохраняйте дисциплину.`,
      });
    }

    if (m.savingsRate > 0 && m.savingsRate < 0.1 && m.surplusMonthly > 0) {
      push(recs, {
        id: "rec-savings-rate",
        kind: "recommendation",
        severity: "warning",
        title: "Доля сбережений ниже 10%",
        body: "Постепенно поднимите норму сбережений до 10–20% дохода.",
        ctaTab: "assets",
      });
    } else if (m.savingsRate >= 0.2) {
      push(recs, {
        id: "rec-savings-high",
        kind: "recommendation",
        severity: "positive",
        title: "Высокая норма сбережений",
        body: `Вы откладываете ≈ ${(m.savingsRate * 100).toFixed(0)}% дохода — распределите по целям.`,
        ctaTab: "plan",
      });
    }
  }

  // ——— Debt ———
  if (m.liabilitiesTotal > 0) {
    if (m.debtServiceRatio > 0.3) {
      push(insights, {
        id: "ins-debt-service",
        kind: "insight",
        severity: "critical",
        title: "Платежи по кредитам >30% дохода",
        body: `Долговой сервис ${(m.debtServiceRatio * 100).toFixed(0)}% дохода — зона риска.`,
        ctaTab: "assets",
      });
    }
    if (m.debtRatio > 0.7) {
      push(recs, {
        id: "rec-ko-high",
        kind: "recommendation",
        severity: "critical",
        title: "Коэффициент обязательств > 0.7",
        body: "Приоритетно снизьте долг: цель — КО ниже 0.5.",
        ctaTab: "assets",
      });
    } else if (m.debtRatio > 0.5) {
      push(recs, {
        id: "rec-ko-mid",
        kind: "recommendation",
        severity: "warning",
        title: "Высокая долговая нагрузка",
        body: `КО ≈ ${(m.debtRatio * 100).toFixed(0)}%. Снизьте обязательства до комфортного уровня.`,
        ctaTab: "assets",
      });
    } else if (m.debtRatio < 0.2) {
      push(recs, {
        id: "rec-ko-low",
        kind: "recommendation",
        severity: "positive",
        title: "Низкая долговая нагрузка",
        body: "Можно сместить фокус на инвестиции и долгосрочные цели.",
        ctaTab: "plan",
      });
    }
    if (m.dividendMonthly < m.debtServiceMonthly && m.investTotal > 0) {
      push(insights, {
        id: "ins-invest-vs-debt",
        kind: "insight",
        severity: "warning",
        title: "Доход от инвестиций ниже платежей по кредитам",
        body: `Дивиденды/аренда ${formatRub(m.dividendMonthly)} vs платежи ${formatRub(m.debtServiceMonthly)}/мес.`,
      });
    }
  } else if (m.step1) {
    push(recs, {
      id: "rec-no-debt",
      kind: "recommendation",
      severity: "positive",
      title: "Нет учтённых пассивов",
      body: "Низкая или нулевая долговая нагрузка — сильная база для накоплений.",
    });
  }

  // ——— Emergency cushion ———
  if (m.hasExpense) {
    if (m.cushionMonths < 1) {
      push(insights, {
        id: "ins-no-cushion",
        kind: "insight",
        severity: "critical",
        title: "Нет финансовой подушки",
        body: "Ликвидных средств меньше 1 месяца расходов. Сформируйте резерв 3–6 месяцев.",
        ctaTab: "assets",
      });
      push(recs, {
        id: "rec-cushion-build",
        kind: "recommendation",
        severity: "critical",
        title: "Создайте подушку безопасности",
        body: "Нацельтесь на 3–6 среднемесячных расходов на счетах и вкладах.",
        ctaTab: "assets",
      });
    } else if (m.cushionMonths < 3) {
      push(insights, {
        id: "ins-thin-cushion",
        kind: "insight",
        severity: "warning",
        title: "Подушка тоньше 3 месяцев",
        body: `Сейчас ≈ ${m.cushionMonths.toFixed(1)} мес. расходов на ликвидных счетах.`,
        ctaTab: "assets",
      });
      push(recs, {
        id: "rec-cushion-grow",
        kind: "recommendation",
        severity: "warning",
        title: "Увеличьте резерв до 3–6 месяцев",
        body: "Это защитит план при потере дохода или внезапных тратах.",
      });
    } else if (m.cushionMonths >= 3 && m.cushionMonths <= 12) {
      push(recs, {
        id: "rec-cushion-ok",
        kind: "recommendation",
        severity: "positive",
        title: "Подушка в норме",
        body: `Резерв ≈ ${m.cushionMonths.toFixed(1)} мес. расходов — поддерживайте уровень.`,
      });
    } else if (m.cushionMonths > 12) {
      push(insights, {
        id: "ins-idle-cash",
        kind: "insight",
        severity: "warning",
        title: "Избыток «спящей» ликвидности",
        body: `Больше 12 мес. расходов на счетах (≈ ${m.cushionMonths.toFixed(0)}). Часть можно направить в инвестиции.`,
        ctaTab: "plan",
      });
      push(recs, {
        id: "rec-idle-invest",
        kind: "recommendation",
        severity: "info",
        title: "Оптимизируйте избыток ликвидности",
        body: "Оставьте 3–6 месяцев резерва, остальное — в цели и портфель.",
        ctaTab: "plan",
        ctaLabel: "Инвест-план",
      });
    }
  }

  if (m.assetsTotal > 0) {
    if (m.liquidShare < 0.1 && m.hasExpense) {
      push(recs, {
        id: "rec-liquid-low",
        kind: "recommendation",
        severity: "warning",
        title: "Ликвидных активов < 10%",
        body: "Увеличьте долю ликвидности до 20–50% капитала для подушки.",
        ctaTab: "assets",
      });
    } else if (m.liquidShare > 0.6) {
      push(recs, {
        id: "rec-liquid-high",
        kind: "recommendation",
        severity: "warning",
        title: "Слишком много ликвидности (>60%)",
        body: "Снизьте долю кэша до 20–50% и направьте избыток в инвестиции.",
        ctaTab: "plan",
      });
    }
  }

  // ——— Portfolio ———
  if (m.investTotal > 0) {
    if (m.weightedReturnPct < 7 && m.weightedVolPct <= 5) {
      push(insights, {
        id: "ins-conservative",
        kind: "insight",
        severity: "warning",
        title: "Портфель слишком консервативный",
        body: `Доходность ≈ ${m.weightedReturnPct.toFixed(1)}% при риске ≈ ${m.weightedVolPct.toFixed(1)}%.`,
        ctaTab: "plan",
      });
    }
    if (m.weightedVolPct > 10 && m.weightedReturnPct < 12) {
      push(insights, {
        id: "ins-aggressive",
        kind: "insight",
        severity: "warning",
        title: "Риск высокий при умеренной доходности",
        body: `Волатильность ≈ ${m.weightedVolPct.toFixed(1)}% при доходности ≈ ${m.weightedReturnPct.toFixed(1)}%.`,
        ctaTab: "plan",
      });
    }
    if (m.weightedReturnPct >= 10 && m.weightedVolPct <= 18) {
      push(insights, {
        id: "ins-return-ok",
        kind: "insight",
        severity: "positive",
        title: "Ожидаемая доходность портфеля на хорошем уровне",
        body: `≈ ${m.weightedReturnPct.toFixed(1)}% годовых при риске ≈ ${m.weightedVolPct.toFixed(1)}%.`,
      });
    }
    if (m.maxAssetShare > 0.7) {
      push(insights, {
        id: "ins-concentration",
        kind: "insight",
        severity: "warning",
        title: "Концентрация >70% в одном активе",
        body: `Крупнейшая позиция ≈ ${(m.maxAssetShare * 100).toFixed(0)}% портфеля.`,
        ctaTab: "assets",
      });
      push(recs, {
        id: "rec-diversify",
        kind: "recommendation",
        severity: "warning",
        title: "Уменьшите концентрацию",
        body: "Распределите капитал шире — минимум 3 класса активов.",
        ctaTab: "assets",
      });
    }
    if (m.assetClassCount >= 3 && m.maxAssetShare <= 0.5) {
      push(recs, {
        id: "rec-diversified",
        kind: "recommendation",
        severity: "positive",
        title: "Диверсификация в порядке",
        body: `${m.assetClassCount} типов активов, крупнейшая доля ≤ 50%.`,
      });
    }
    if (m.investShare < 0.1 && m.assetsTotal > 0) {
      push(recs, {
        id: "rec-invest-share-low",
        kind: "recommendation",
        severity: "info",
        title: "Доля инвестиций < 10% капитала",
        body: "При комфортном долге и подушке цель — 15–30% в инвестициях.",
        ctaTab: "plan",
      });
    }
  } else if (m.hasAssets && m.surplusMonthly > 0) {
    push(recs, {
      id: "rec-start-invest",
      kind: "recommendation",
      severity: "info",
      title: "Нет инвестиционных активов",
      body: "Добавьте брокерский счёт или фонд и зафиксируйте план взносов.",
      ctaTab: "assets",
    });
  }

  // ——— Goals / plan ———
  if (m.hasGoals && m.recommendedMonthlySaving > 0) {
    if (m.goalsFundable === false) {
      push(insights, {
        id: "ins-goals-hard",
        kind: "insight",
        severity: "warning",
        title: "Цели слабо достижимы при текущем взносе",
        body: `Нужно ≈ ${formatRub(m.recommendedMonthlySaving)}/мес, профицит ${formatRub(m.surplusMonthly)}. Разрыв >20%.`,
        ctaTab: "plan",
      });
      push(recs, {
        id: "rec-goals-adjust",
        kind: "recommendation",
        severity: "warning",
        title: "Пересмотрите цели или взнос",
        body: "Увеличьте срок/снизьте сумму цели либо поднимите ежемесячные отчисления.",
        ctaTab: "plan",
        ctaLabel: "К плану",
      });
      if (m.surplusMonthly > 0) {
        const boost = 1.2;
        push(insights, {
          id: "ins-boost-save",
          kind: "insight",
          severity: "info",
          title: "Если откладывать на 20% больше",
          body: `Взнос ≈ ${formatRub(m.surplusMonthly * boost)}/мес заметно сократит срок достижения целей.`,
          ctaTab: "plan",
        });
      }
    } else if (m.goalsFundable === true) {
      push(insights, {
        id: "ins-goals-ok",
        kind: "insight",
        severity: "positive",
        title: "Цели обеспечены текущим профицитом",
        body: `Рекомендуемый взнос ${formatRub(m.recommendedMonthlySaving)}/мес укладывается в баланс.`,
      });
    }
  }

  if (m.hasGoals && !m.hasScenarios) {
    push(recs, {
      id: "rec-scenarios",
      kind: "recommendation",
      severity: "info",
      title: "Добавьте сценарное планирование",
      body: "Проверьте устойчивость плана к потере дохода или шоку инфляции.",
      ctaTab: "plan",
      ctaLabel: "К плану",
    });
  }

  if (m.avgGoalProbability != null) {
    const p = m.avgGoalProbability;
    if (p < 0.5) {
      push(insights, {
        id: "ins-mc-low",
        kind: "insight",
        severity: "warning",
        title: "Низкая вероятность целей в Monte Carlo",
        body: `Средняя вероятность ≈ ${(p * 100).toFixed(0)}%. Усильте взнос или смягчите цели.`,
        ctaTab: "plan",
      });
    } else if (p >= 0.7) {
      push(insights, {
        id: "ins-mc-high",
        kind: "insight",
        severity: "positive",
        title: "Высокая достижимость по Monte Carlo",
        body: `Средняя вероятность ≈ ${(p * 100).toFixed(0)}% — план выглядит устойчивым.`,
      });
    }
  } else if (m.step3) {
    push(recs, {
      id: "rec-run-mc",
      kind: "recommendation",
      severity: "info",
      title: "Запустите Monte Carlo",
      body: "Увидите вероятности достижения целей с учётом риска доходности.",
      ctaTab: "plan",
      ctaLabel: "К плану",
    });
  }

  // Combined: strong healthy profile
  if (
    m.cushionMonths >= 3 &&
    m.cushionMonths <= 12 &&
    m.surplusMonthly > 0 &&
    m.debtRatio < 0.3 &&
    m.step3
  ) {
    push(insights, {
      id: "ins-healthy",
      kind: "insight",
      severity: "positive",
      title: "Финансовая база в хорошей форме",
      body: "Есть профицит, умеренный долг и подушка — сильная отправная точка CFP.",
    });
  }

  return prioritize([...insights, ...recs]);
}

function prioritize(items: DashboardInsight[]): DashboardInsight[] {
  const rank: Record<InsightSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    positive: 3,
  };
  const seen = new Set<string>();
  return items
    .filter((i) => {
      if (seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    })
    .sort((a, b) => rank[a.severity] - rank[b.severity])
    .slice(0, 14);
}

export function topActions(items: DashboardInsight[]): DashboardInsight[] {
  return items
    .filter(
      (i) =>
        i.ctaTab &&
        (i.severity === "critical" || i.severity === "warning" || i.kind === "recommendation"),
    )
    .slice(0, 3);
}

