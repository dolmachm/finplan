import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import { parseJsonBody } from "@/shared/api-validation";
import { defaultInvestmentPlan, seedFromFinanceData } from "@/modules/iplan/defaults";
import { runIPlanProjection, weightedReturnPct } from "@/modules/iplan/iplan.engine";
import type { IPlanVariant, InvestmentPlan } from "@/modules/iplan/types";
import type { Asset, Goal, Income, MacroSettings } from "@/shared/types";

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
  includeInitialCapital: z.boolean(),
  returnSchedule: z
    .array(
      z.object({
        fromYear: z.number().int().nullable(),
        ratePct: z.number(),
      }),
    )
    .min(1),
  contributions: z.array(streamSchema).max(6),
  goals: z.array(streamSchema).max(6),
});

const putSchema = z.object({
  activeVariantId: z.string(),
  variants: z.array(variantSchema).min(1).max(6),
});

async function loadContext(userId: string) {
  const [plan, assets, incomes, goals, macro] = await Promise.all([
    prisma.investmentPlan.findUnique({ where: { userId } }),
    prisma.asset.findMany({ where: { userId } }),
    prisma.income.findMany({ where: { userId } }),
    prisma.goal.findMany({ where: { userId }, orderBy: { priority: "asc" } }),
    prisma.macroSettings.findUnique({ where: { userId } }),
  ]) as [
    InvestmentPlan | null,
    Asset[],
    Income[],
    Goal[],
    MacroSettings | null,
  ];

  const investmentAssets = assets.filter((a) => a.assetClass === "INVESTMENT");
  const capitalAssets = investmentAssets.length > 0 ? investmentAssets : assets;
  const initialCapital = capitalAssets.reduce((s, a) => s + a.currentValue, 0);
  const wRet = weightedReturnPct(capitalAssets);

  return { plan, assets, capitalAssets, initialCapital, wRet, incomes, goals, macro };
}

function ensurePlan(
  userId: string,
  ctx: Awaited<ReturnType<typeof loadContext>>,
): InvestmentPlan {
  if (ctx.plan) return ctx.plan;
  return seedFromFinanceData({
    userId,
    investmentAssetsTotal: ctx.initialCapital,
    weightedReturnPct: ctx.wRet,
    incomes: ctx.incomes,
    goals: ctx.goals,
    horizonYears: ctx.macro?.planHorizonYears ?? 30,
  });
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

  const active =
    plan.variants.find((v) => v.id === plan!.activeVariantId) ?? plan.variants[0]!;
  const projection = runIPlanProjection(active, ctx.initialCapital);
  const comparisons = plan.variants.map((v) =>
    runIPlanProjection(v, ctx.initialCapital),
  );

  return NextResponse.json({
    plan,
    assets: ctx.assets,
    capitalAssets: ctx.capitalAssets,
    initialCapital: ctx.initialCapital,
    suggestedReturnPct: ctx.wRet,
    projection,
    comparisons,
  });
}

export async function PUT(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const parsed = parseJsonBody(putSchema, await req.json());
  if (!parsed.ok) return parsed.response;

  const existing = await prisma.investmentPlan.findUnique({ where: { userId } });
  const base = existing ?? defaultInvestmentPlan(userId);

  const next: InvestmentPlan = {
    ...base,
    activeVariantId: parsed.data.activeVariantId,
    variants: parsed.data.variants as IPlanVariant[],
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

  const ctx = await loadContext(userId);
  const active =
    saved.variants.find((v) => v.id === saved.activeVariantId) ?? saved.variants[0]!;
  const projection = runIPlanProjection(active, ctx.initialCapital);
  const comparisons = saved.variants.map((v) =>
    runIPlanProjection(v, ctx.initialCapital),
  );

  return NextResponse.json({
    plan: saved,
    assets: ctx.assets,
    capitalAssets: ctx.capitalAssets,
    initialCapital: ctx.initialCapital,
    suggestedReturnPct: ctx.wRet,
    projection,
    comparisons,
  });
}
