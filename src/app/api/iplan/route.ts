import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import { parseJsonBody } from "@/shared/api-validation";
import { defaultInvestmentPlan, seedFromFinanceData } from "@/modules/iplan/defaults";
import {
  normalizeVariant,
  runIPlanMonteCarlo,
  runIPlanProjection,
  weightedReturnPct,
  weightedVolatilityPct,
} from "@/modules/iplan/iplan.engine";
import {
  baselineMonthlySurplus,
  toBudgetLines,
  validateContributionsVsBudget,
} from "@/modules/iplan/budget";
import { envelopeReserveBudgetLine } from "@/modules/budget/envelopes";
import type { IPlanVariant, InvestmentPlan } from "@/modules/iplan/types";
import type {
  Asset,
  BudgetCategory,
  Expense,
  Goal,
  Income,
  MacroSettings,
} from "@/shared/types";
import { recordRevision } from "@/shared/revision";
import { newId } from "@/shared/db/helpers";

const streamSchema = z.object({
  id: z.string(),
  name: z.string(),
  amount: z.number(),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "YEARLY", "PERIOD"]),
  startYear: z.number().int(),
  endYear: z.number().int(),
  enabled: z.boolean(),
  linkedEntityId: z.string().nullable(),
});

const variantSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  startYear: z.number().int(),
  horizonYears: z.number().int().min(1).max(100),
  age: z.number().int().min(0).max(120).default(40),
  includeInitialCapital: z.boolean(),
  distribution: z.enum(["RISK_FREE", "NORMAL", "LOGNORMAL"]).default("LOGNORMAL"),
  axisMode: z.enum(["INDEX", "YEAR", "AGE"]).default("YEAR"),
  percentileLow: z.number().min(0).max(50).default(10),
  percentileHigh: z.number().min(50).max(100).default(90),
  mcRuns: z.number().int().min(50).max(2000).default(500),
  returnSchedule: z
    .array(
      z.object({
        fromYear: z.number().int().nullable(),
        ratePct: z.number(),
        volatilityPct: z.number().default(15),
      }),
    )
    .min(1)
    .max(6),
  contributions: z.array(streamSchema).max(9),
  goals: z.array(streamSchema).max(9),
});

const putSchema = z.object({
  activeVariantId: z.string(),
  variants: z.array(variantSchema).min(1).max(6),
});

async function loadContext(userId: string) {
  const [plan, assets, incomes, expenses, goals, macro, budgetCategories] =
    await Promise.all([
      prisma.investmentPlan.findUnique({ where: { userId } }),
      prisma.asset.findMany({ where: { userId } }),
      prisma.income.findMany({ where: { userId } }),
      prisma.expense.findMany({ where: { userId } }),
      prisma.goal.findMany({ where: { userId }, orderBy: { priority: "asc" } }),
      prisma.macroSettings.findUnique({ where: { userId } }),
      prisma.budgetCategory.findMany({
        where: { userId },
        orderBy: { sortOrder: "asc" },
      }),
    ]) as [
      InvestmentPlan | null,
      Asset[],
      Income[],
      Expense[],
      Goal[],
      MacroSettings | null,
      BudgetCategory[],
    ];

  const investmentAssets = assets.filter((a) => a.assetClass === "INVESTMENT");
  const capitalAssets = investmentAssets.length > 0 ? investmentAssets : assets;
  const initialCapital = capitalAssets.reduce((s, a) => s + a.currentValue, 0);
  const wRet = weightedReturnPct(capitalAssets);
  const wVol = weightedVolatilityPct(capitalAssets);
  const budgetIncomes = toBudgetLines(incomes);
  const reserve = envelopeReserveBudgetLine(expenses, budgetCategories);
  const budgetExpenses = toBudgetLines(
    reserve ? [...expenses, reserve] : expenses,
  );
  const surplusMonthly = baselineMonthlySurplus(budgetIncomes, budgetExpenses);

  return {
    plan,
    assets,
    capitalAssets,
    initialCapital,
    wRet,
    wVol,
    incomes,
    expenses,
    budgetCategories,
    budgetIncomes,
    budgetExpenses,
    surplusMonthly,
    goals,
    macro,
  };
}

/** Keep a single contribution stream synced to monthly surplus from Data */
function syncSurplusContribution(
  variant: IPlanVariant,
  surplusMonthly: number,
): IPlanVariant {
  const v = normalizeVariant(variant);
  const y = v.startYear;
  const end = y + Math.max(0, v.horizonYears - 1);
  const existing = v.contributions.find((c) => c.linkedEntityId === "__surplus__");
  const others = v.contributions.filter((c) => c.linkedEntityId !== "__surplus__");
  const surplusStream = {
    id: existing?.id ?? newId(),
    name: "Взнос = доходы − расходы",
    amount: Math.max(0, Math.round(surplusMonthly)),
    frequency: "MONTHLY" as const,
    startYear: existing?.startYear ?? y,
    endYear: existing?.endYear ?? end,
    enabled: existing?.enabled ?? surplusMonthly > 0,
    linkedEntityId: "__surplus__",
  };
  return { ...v, contributions: [surplusStream, ...others] };
}

function ensurePlan(
  userId: string,
  ctx: Awaited<ReturnType<typeof loadContext>>,
): InvestmentPlan {
  if (ctx.plan) {
    return {
      ...ctx.plan,
      variants: ctx.plan.variants.map((v) =>
        syncSurplusContribution(v, ctx.surplusMonthly),
      ),
    };
  }
  const seeded = seedFromFinanceData({
    userId,
    investmentAssetsTotal: ctx.initialCapital,
    weightedReturnPct: ctx.wRet,
    weightedVolatilityPct: ctx.wVol,
    incomes: ctx.incomes,
    goals: ctx.goals,
    horizonYears: ctx.macro?.planHorizonYears ?? 30,
    surplusMonthly: ctx.surplusMonthly,
  });
  return {
    ...seeded,
    variants: seeded.variants.map((v) =>
      syncSurplusContribution(v, ctx.surplusMonthly),
    ),
  };
}

function payload(
  plan: InvestmentPlan,
  ctx: Awaited<ReturnType<typeof loadContext>>,
) {
  const normalized: InvestmentPlan = {
    ...plan,
    variants: plan.variants.map((v) =>
      syncSurplusContribution(normalizeVariant(v), ctx.surplusMonthly),
    ),
  };
  const active =
    normalized.variants.find((v) => v.id === normalized.activeVariantId) ??
    normalized.variants[0]!;
  const projection = runIPlanProjection(
    active,
    ctx.initialCapital,
    ctx.budgetIncomes,
    ctx.budgetExpenses,
  );
  const monteCarlo = runIPlanMonteCarlo(
    active,
    ctx.initialCapital,
    ctx.budgetIncomes,
    ctx.budgetExpenses,
  );
  const comparisons = normalized.variants.map((v) =>
    runIPlanProjection(v, ctx.initialCapital, ctx.budgetIncomes, ctx.budgetExpenses),
  );
  return {
    plan: normalized,
    assets: ctx.assets,
    capitalAssets: ctx.capitalAssets,
    initialCapital: ctx.initialCapital,
    suggestedReturnPct: ctx.wRet,
    suggestedVolatilityPct: ctx.wVol,
    incomes: ctx.incomes,
    expenses: ctx.expenses,
    budgetCategories: ctx.budgetCategories,
    surplusMonthly: ctx.surplusMonthly,
    surplusAnnual: ctx.surplusMonthly * 12,
    projection,
    monteCarlo,
    comparisons,
  };
}

export async function GET() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const ctx = await loadContext(userId);
  let plan = ctx.plan;
  if (!plan) {
    plan = ensurePlan(userId, ctx);
    await prisma.investmentPlan.upsert({
      where: { userId },
      create: plan,
      update: plan,
    });
  }

  return NextResponse.json(payload(ensurePlan(userId, { ...ctx, plan }), ctx));
}

export async function PUT(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const parsed = parseJsonBody(putSchema, await req.json());
  if (!parsed.ok) return parsed.response;

  const ctx = await loadContext(userId);
  const existing = ctx.plan;
  const base = existing ?? defaultInvestmentPlan(userId);

  const variants = parsed.data.variants.map((v) =>
    syncSurplusContribution(normalizeVariant(v as IPlanVariant), ctx.surplusMonthly),
  );

  for (const v of variants) {
    const check = validateContributionsVsBudget({
      contributions: v.contributions,
      incomes: ctx.budgetIncomes,
      expenses: ctx.budgetExpenses,
      startYear: v.startYear,
      horizonYears: v.horizonYears,
    });
    if (!check.ok) {
      return NextResponse.json({ error: check.message }, { status: 400 });
    }
  }

  const next: InvestmentPlan = {
    ...base,
    activeVariantId: parsed.data.activeVariantId,
    variants,
    updatedAt: new Date(),
  };

  if (!next.variants.some((v) => v.id === next.activeVariantId)) {
    next.activeVariantId = next.variants[0]!.id;
  }

  const saved = await prisma.investmentPlan.upsert({
    where: { userId },
    create: next,
    update: {
      activeVariantId: next.activeVariantId,
      variants: next.variants,
    },
  });

  await recordRevision({
    userId,
    entityType: "iplan",
    entityId: saved.id,
    action: existing ? "UPDATE" : "CREATE",
    label: `Инвест-план: ${next.variants.length} вариант(ов)`,
    before: existing,
    after: saved,
  });

  return NextResponse.json(payload(saved, ctx));
}
