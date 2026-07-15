import { unauthorizedResponse } from "@/shared/api-validation";
import type {
  Asset,
  Expense,
  Goal,
  Income,
  Liability,
  MacroSettings,
  User,
} from "@/shared/types";
import { NextResponse } from "next/server";
import { auth } from "@/shared/auth";
import { prisma } from "@/shared/db";
import { generatePlanPdf } from "@/modules/reports/pdf-export";
import { buildReportPayload } from "@/modules/reports/build-report-data";
import {
  createDefaultReportConfig,
  mergeReportConfig,
  type ReportConfig,
} from "@/modules/reports/report-config";
import { buildPlanInputFromEntities } from "@/modules/plan/plan-data.service";
import { runDeterministicPlan } from "@/modules/plan/cashflow.engine";

async function generateForUser(userId: string, config: ReportConfig) {
  const [
    user,
    macro,
    assets,
    liabilities,
    incomes,
    expenses,
    goals,
    scenarioCount,
    lastSim,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.macroSettings.findUnique({ where: { userId } }),
    prisma.asset.findMany({ where: { userId } }),
    prisma.liability.findMany({ where: { userId } }),
    prisma.income.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
    prisma.goal.findMany({ where: { userId }, orderBy: { priority: "asc" } }),
    prisma.scenario.count({ where: { userId } }),
    prisma.simulationJob.findFirst({
      where: { userId, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      include: { result: true },
    }),
  ]) as [
    User | null,
    MacroSettings | null,
    Asset[],
    Liability[],
    Income[],
    Expense[],
    Goal[],
    number,
    Awaited<ReturnType<typeof prisma.simulationJob.findFirst>>,
  ];

  const planInput = buildPlanInputFromEntities(userId, {
    macro,
    assets,
    liabilities,
    incomes,
    expenses,
    goals,
  });
  const det = runDeterministicPlan(planInput);
  const goalProbabilities = (lastSim?.result?.goalProbabilities ?? []) as Array<{
    goalId: string;
    probability: number;
  }>;

  const payload = buildReportPayload({
    config,
    userName: user?.name ?? user?.email ?? "User",
    assets,
    liabilities,
    incomes,
    expenses,
    goals,
    scenarioCount,
    macro: {
      baseInflationPct: macro?.baseInflationPct ?? 4,
      planHorizonYears: macro?.planHorizonYears ?? 30,
      incomeTaxPct: macro?.incomeTaxPct ?? 13,
    },
    det,
    goalProbabilities,
  });

  return generatePlanPdf(payload);
}

function pdfResponse(pdf: Uint8Array) {
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="finplan-report.pdf"',
    },
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }
  const pdf = await generateForUser(
    session.user.id,
    createDefaultReportConfig(),
  );
  return pdfResponse(pdf);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const config = mergeReportConfig(
    (body && typeof body === "object"
      ? (body as Partial<ReportConfig>)
      : null) ?? null,
  );

  const pdf = await generateForUser(session.user.id, config);
  return pdfResponse(pdf);
}
