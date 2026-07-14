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
    includeInitialCapital: true,
    returnSchedule: [{ fromYear: null, ratePct: 6 }],
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
    { fromYear: null, ratePct: Math.round(params.weightedReturnPct * 10) / 10 || 6 },
  ];

  const salaryLike = params.incomes.filter((i) =>
    ["MONTHLY", "QUARTERLY", "YEARLY"].includes(i.frequency),
  );
  v.contributions = salaryLike.slice(0, 6).map((inc) => {
    const start = inc.startDate ? inc.startDate.getFullYear() : y;
    const end = inc.endDate ? inc.endDate.getFullYear() : y + Math.min(20, params.horizonYears);
    return {
      id: newId(),
      name: inc.name,
      amount: inc.amount,
      frequency:
        inc.frequency === "QUARTERLY"
          ? ("QUARTERLY" as const)
          : inc.frequency === "YEARLY"
            ? ("YEARLY" as const)
            : ("MONTHLY" as const),
      startYear: start,
      endYear: end,
      enabled: true,
      linkedEntityId: inc.id,
    };
  });
  if (v.contributions.length === 0) {
    v.contributions = [
      emptyStream({
        name: "Отчисления",
        enabled: false,
        startYear: y,
        endYear: y + 15,
      }),
    ];
  }

  v.goals = params.goals.slice(0, 6).map((g) => {
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
  return plan;
}
