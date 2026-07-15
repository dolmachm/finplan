import { monthlyEquivalent } from "@/modules/plan/frequency";
import type { PlanFrequency } from "@/modules/plan/frequency";
import {
  budgetExpenseFloor,
  envelopeStatuses,
} from "@/modules/budget/envelopes";
import type { BudgetCategory, Expense, Income } from "@/shared/types";

export type SavingsAction = "cut" | "raise" | "tighten" | "deploy";

export type SavingsRecommendation = {
  id: string;
  action: SavingsAction;
  title: string;
  body: string;
  /** Expected monthly boost to savings if followed */
  impactMonthly: number;
};

export type SavingsCorridor = {
  incomeMonthly: number;
  expenseMonthly: number;
  /** income − expense — сколько можно откладывать сейчас */
  deltaMonthly: number;
  savingsRate: number;
  /** После финансирования конвертов (лимитов) */
  afterEnvelopesMonthly: number;
  corridor: {
    low: number;
    base: number;
    stretch: number;
  };
  /** Цели нормы сбережений от дохода */
  targets: {
    rate10: number;
    rate20: number;
    gapTo10: number;
    gapTo20: number;
  };
  recommendations: SavingsRecommendation[];
  /** Накопленная динамика на 12 мес. */
  trajectory: Array<{
    month: number;
    low: number;
    base: number;
    stretch: number;
  }>;
};

function freq(amount: number, frequency: string) {
  return monthlyEquivalent(amount, frequency as PlanFrequency);
}

export function buildSavingsCorridor(input: {
  incomes: Income[];
  expenses: Expense[];
  budgetCategories?: BudgetCategory[];
}): SavingsCorridor | null {
  const { incomes, expenses, budgetCategories = [] } = input;
  if (incomes.length === 0 && expenses.length === 0) return null;

  const incomeMonthly = incomes.reduce(
    (s, i) => s + freq(i.amount, i.frequency),
    0,
  );
  const expenseMonthly = expenses.reduce(
    (s, e) => s + freq(e.amount, e.frequency),
    0,
  );
  const deltaMonthly = incomeMonthly - expenseMonthly;
  const savingsRate = incomeMonthly > 0 ? deltaMonthly / incomeMonthly : 0;
  const floor = budgetExpenseFloor(expenses, budgetCategories);
  const afterEnvelopesMonthly = incomeMonthly - floor;

  const envelopes = envelopeStatuses(expenses, budgetCategories);
  const overspendTotal = envelopes
    .filter((e) => e.overspent && e.remaining != null)
    .reduce((s, e) => s + Math.abs(e.remaining as number), 0);

  const variableMonthly = expenses
    .filter((e) => !e.isEssential)
    .reduce((s, e) => s + freq(e.amount, e.frequency), 0);
  const trimPotential = variableMonthly * 0.15;

  const base = deltaMonthly;
  const low = afterEnvelopesMonthly;
  const stretchRaw = base + overspendTotal + trimPotential;
  const essentialMonthly = expenses
    .filter((e) => e.isEssential)
    .reduce((s, e) => s + freq(e.amount, e.frequency), 0);
  const stretchCap =
    incomeMonthly > 0
      ? Math.max(base, incomeMonthly - essentialMonthly * 0.95)
      : stretchRaw;
  const stretch = Math.max(base, Math.min(stretchRaw, stretchCap));

  const rate10 = incomeMonthly * 0.1;
  const rate20 = incomeMonthly * 0.2;

  const recommendations = buildRecommendations({
    incomeMonthly,
    expenseMonthly,
    deltaMonthly,
    afterEnvelopesMonthly,
    expenses,
    envelopes,
    overspendTotal,
    variableMonthly,
    trimPotential,
    rate10,
    rate20,
  });

  const trajectory = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    return {
      month,
      low: Math.max(0, low) * month,
      base: Math.max(0, base) * month,
      stretch: Math.max(0, stretch) * month,
    };
  });

  return {
    incomeMonthly,
    expenseMonthly,
    deltaMonthly,
    savingsRate,
    afterEnvelopesMonthly,
    corridor: {
      low: Math.round(low),
      base: Math.round(base),
      stretch: Math.round(stretch),
    },
    targets: {
      rate10: Math.round(rate10),
      rate20: Math.round(rate20),
      gapTo10: Math.round(rate10 - deltaMonthly),
      gapTo20: Math.round(rate20 - deltaMonthly),
    },
    recommendations,
    trajectory,
  };
}

function buildRecommendations(p: {
  incomeMonthly: number;
  expenseMonthly: number;
  deltaMonthly: number;
  afterEnvelopesMonthly: number;
  expenses: Expense[];
  envelopes: ReturnType<typeof envelopeStatuses>;
  overspendTotal: number;
  variableMonthly: number;
  trimPotential: number;
  rate10: number;
  rate20: number;
}): SavingsRecommendation[] {
  const out: SavingsRecommendation[] = [];

  if (p.deltaMonthly <= 0) {
    out.push({
      id: "close-deficit",
      action: "cut",
      title: "Закройте дефицит",
      body: `Расходы выше доходов на ${Math.abs(Math.round(p.deltaMonthly)).toLocaleString("ru-RU")} ₽/мес. Сначала выровняйте баланс.`,
      impactMonthly: Math.abs(p.deltaMonthly),
    });
  }

  const overspent = p.envelopes
    .filter((e) => e.overspent)
    .sort(
      (a, b) =>
        Math.abs(b.remaining ?? 0) - Math.abs(a.remaining ?? 0),
    );
  for (const e of overspent.slice(0, 2)) {
    const impact = Math.abs(e.remaining ?? 0);
    out.push({
      id: `cut-envelope-${e.categoryId}`,
      action: "tighten",
      title: `Сократите «${e.name}»`,
      body: `Перерасход ${Math.round(impact).toLocaleString("ru-RU")} ₽/мес относительно лимита — урезание до лимита увеличит отложения.`,
      impactMonthly: impact,
    });
  }

  const variable = p.expenses
    .filter((e) => !e.isEssential)
    .map((e) => ({
      e,
      monthly: freq(e.amount, e.frequency),
    }))
    .sort((a, b) => b.monthly - a.monthly);

  for (const { e, monthly } of variable.slice(0, 2)) {
    const cut = monthly * 0.15;
    if (cut < 500) continue;
    out.push({
      id: `trim-${e.id}`,
      action: "cut",
      title: `Подкрутите «${e.name}»`,
      body: `Переменный расход ≈ ${Math.round(monthly).toLocaleString("ru-RU")} ₽/мес. Сокращение на 15% даст ≈ ${Math.round(cut).toLocaleString("ru-RU")} ₽ к накоплениям.`,
      impactMonthly: cut,
    });
  }

  if (p.deltaMonthly > 0 && p.rate10 - p.deltaMonthly > 0 && p.incomeMonthly > 0) {
    const gap = p.rate10 - p.deltaMonthly;
    out.push({
      id: "reach-10",
      action: "cut",
      title: "Доведите норму до 10%",
      body: `Сейчас ≈ ${((p.deltaMonthly / p.incomeMonthly) * 100).toFixed(0)}% дохода. До коридора 10% не хватает ${Math.round(gap).toLocaleString("ru-RU")} ₽/мес.`,
      impactMonthly: gap,
    });
  } else if (
    p.deltaMonthly > 0 &&
    p.rate20 - p.deltaMonthly > 0 &&
    p.deltaMonthly < p.rate20
  ) {
    const gap = p.rate20 - p.deltaMonthly;
    out.push({
      id: "reach-20",
      action: "cut",
      title: "Цель: 20% дохода",
      body: `До комфортной нормы 20% осталось ${Math.round(gap).toLocaleString("ru-RU")} ₽/мес — через лимиты конвертов или рост дохода.`,
      impactMonthly: gap,
    });
  }

  if (p.afterEnvelopesMonthly + 0.01 < p.deltaMonthly && p.deltaMonthly > 0) {
    out.push({
      id: "envelope-reserve",
      action: "tighten",
      title: "Лимиты «съедают» профицит",
      body: `После конвертов свободно ${Math.round(p.afterEnvelopesMonthly).toLocaleString("ru-RU")} ₽/мес вместо ${Math.round(p.deltaMonthly).toLocaleString("ru-RU")}. Пересмотрите завышенные лимиты.`,
      impactMonthly: p.deltaMonthly - p.afterEnvelopesMonthly,
    });
  }

  if (p.incomeMonthly > 0 && p.deltaMonthly < p.rate10) {
    const need = Math.max(p.rate10 - p.deltaMonthly, p.incomeMonthly * 0.05);
    out.push({
      id: "raise-income",
      action: "raise",
      title: "Или увеличьте доход",
      body: `Доп. ${Math.round(need).toLocaleString("ru-RU")} ₽/мес дохода при тех же расходах выведет вас к норме сбережений ≥10%.`,
      impactMonthly: need,
    });
  }

  if (p.deltaMonthly >= p.rate10 && p.deltaMonthly > 0) {
    out.push({
      id: "deploy",
      action: "deploy",
      title: "Направьте остаток в план",
      body: `Можно стабильно откладывать ${Math.round(p.deltaMonthly).toLocaleString("ru-RU")} ₽/мес — зафиксируйте взнос в инвест-плане.`,
      impactMonthly: p.deltaMonthly,
    });
  }

  return out.slice(0, 5);
}
