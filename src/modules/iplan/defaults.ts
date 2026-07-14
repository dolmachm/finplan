import { newId } from "@/shared/db/helpers";
import type { IPlanStream, IPlanVariant, InvestmentPlan } from "./types";

function emptyStream(partial?: Partial<IPlanStream>): IPlanStream {
  const y = new Date().getFullYear();
  return {
    id: newId(),
    name: "",
    amount: 0,
    frequency: "MONTHLY",
    startYear: y,
    endYear: y + 10,
    enabled: false,
    linkedEntityId: null,
    ...partial,
  };
}

export function defaultVariant(name = "Вариант 1"): IPlanVariant {
  const y = new Date().getFullYear();
  return {
    id: newId(),
    name,
    startYear: y,
    horizonYears: 30,
    age: 40,
    includeInitialCapital: true,
    distribution: "LOGNORMAL",
    axisMode: "YEAR",
    percentileLow: 10,
    percentileHigh: 90,
    mcRuns: 500,
    returnSchedule: [{ fromYear: null, ratePct: 6, volatilityPct: 15 }],
    contributions: [
      emptyStream({
        name: "Отчисления от зарплаты",
        amount: 0,
        frequency: "MONTHLY",
        startYear: y,
        endYear: y + 15,
        enabled: false,
      }),
    ],
    goals: [],
  };
}

export function defaultInvestmentPlan(userId: string): InvestmentPlan {
  const v = defaultVariant("Базовый");
  const ts = new Date();
  return {
    id: newId(),
    userId,
    activeVariantId: v.id,
    variants: [v],
    createdAt: ts,
    updatedAt: ts,
  };
}

export function seedFromFinanceData(params: {
  userId: string;
  investmentAssetsTotal: number;
  weightedReturnPct: number;
  weightedVolatilityPct?: number;
  surplusMonthly?: number;
  incomes: Array<{
    id: string;
    name: string;
    amount: number;
    frequency: string;
    startDate: Date | null;
    endDate: Date | null;
  }>;
  goals: Array<{
    id: string;
    name: string;
    targetAmountNominal: number;
    targetDate: Date;
  }>;
  horizonYears: number;
}): InvestmentPlan {
  const plan = defaultInvestmentPlan(params.userId);
  const v = plan.variants[0]!;
  const y = new Date().getFullYear();
  v.horizonYears = params.horizonYears;
  v.startYear = y;
  v.returnSchedule = [
    {
      fromYear: null,
      ratePct: Math.round(params.weightedReturnPct * 10) / 10 || 6,
      volatilityPct:
        Math.round((params.weightedVolatilityPct ?? 15) * 10) / 10 || 15,
    },
  ];

  const surplus = Math.max(0, Math.round(params.surplusMonthly ?? 0));
  v.contributions = [
    {
      id: newId(),
      name: "Взнос = доходы − расходы",
      amount: surplus,
      frequency: "MONTHLY",
      startYear: y,
      endYear: y + Math.min(20, params.horizonYears) - 1,
      enabled: surplus > 0,
      linkedEntityId: "__surplus__",
    },
  ];

  v.goals = params.goals.slice(0, 9).map((g) => {
    const targetYear = g.targetDate.getFullYear();
    return {
      id: newId(),
      name: g.name,
      amount: g.targetAmountNominal,
      frequency: "YEARLY" as const,
      startYear: targetYear,
      endYear: targetYear,
      enabled: true,
      linkedEntityId: g.id,
    };
  });

  void params.investmentAssetsTotal;
  void params.incomes;
  return plan;
}
