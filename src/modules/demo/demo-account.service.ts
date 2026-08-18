import { prisma } from "@/shared/db";
import { now, setJson } from "@/shared/db/helpers";
import { redis } from "@/shared/redis";
import type {
  Asset,
  Expense,
  Goal,
  Income,
  Liability,
  MacroSettings,
  Scenario,
} from "@/shared/types";
import { loadUserFinanceSnapshot } from "@/modules/finance/finance-snapshot";
import { seedPredefinedScenarios } from "@/modules/simulation/simulation.service";
import { wipeUserData } from "@/modules/account/account.service";

const DEMO_TEMPLATE_USER_ID = "__demo_template__";

function activeDemoKey(ownerUserId: string): string {
  return `demo:active:${ownerUserId}`;
}

function sandboxReadyKey(ownerUserId: string): string {
  return `demo:sandbox:ready:${ownerUserId}`;
}

function demoUserId(ownerUserId: string): string {
  return `demo:${ownerUserId}`;
}

type DemoStatus = {
  active: boolean;
  hasSandbox: boolean;
  sandboxUserId: string | null;
};

async function ensureTemplateData(userId = DEMO_TEMPLATE_USER_ID): Promise<void> {
  const snapshot = await loadUserFinanceSnapshot(userId);
  if (
    snapshot.assets.length > 0 &&
    snapshot.liabilities.length > 0 &&
    snapshot.incomes.length > 0 &&
    snapshot.expenses.length > 0 &&
    snapshot.goals.length > 0 &&
    snapshot.budgetCategories.length > 0
  ) {
    return;
  }

  await wipeUserData(userId);

  const ts = now();
  const macro: MacroSettings = {
    id: crypto.randomUUID(),
    userId,
    baseCurrency: "RUB",
    baseInflationPct: 4,
    incomeTaxPct: 13,
    planHorizonYears: 35,
    discountRatePct: 6,
    createdAt: ts,
    updatedAt: ts,
  };
  await setJson(`macro:${userId}`, macro);

  const expenseHousing = await prisma.budgetCategory.create({
    data: {
      userId,
      name: "Жильё",
      kind: "expense",
      monthlyLimit: 170000,
      sortOrder: 1,
    },
  });
  const expenseLifestyle = await prisma.budgetCategory.create({
    data: {
      userId,
      name: "Образ жизни",
      kind: "expense",
      monthlyLimit: 90000,
      sortOrder: 2,
    },
  });
  const expenseFamily = await prisma.budgetCategory.create({
    data: {
      userId,
      name: "Семья и образование",
      kind: "expense",
      monthlyLimit: 70000,
      sortOrder: 3,
    },
  });
  const incomeCareer = await prisma.budgetCategory.create({
    data: {
      userId,
      name: "Основной доход",
      kind: "income",
      monthlyLimit: null,
      sortOrder: 1,
    },
  });
  const incomePassive = await prisma.budgetCategory.create({
    data: {
      userId,
      name: "Пассивный доход",
      kind: "income",
      monthlyLimit: null,
      sortOrder: 2,
    },
  });

  const emergencyFund = await prisma.asset.create({
    data: {
      userId,
      name: "Подушка безопасности",
      type: "BANK_ACCOUNT",
      assetClass: "PERSONAL",
      currentValue: 1800000,
      currency: "RUB",
      expectedReturnPct: 5.5,
      volatilityPct: 1,
      liquidityDays: 1,
      maintenanceCostMonthly: 0,
      dividendIncomeMonthly: 0,
      taxEffectPct: 0,
      isRealReturn: false,
      notes: "Резерв на 9-10 месяцев расходов",
    },
  });

  const portfolio = await prisma.asset.create({
    data: {
      userId,
      name: "Глобальный портфель",
      type: "BROKERAGE",
      assetClass: "INVESTMENT",
      currentValue: 12600000,
      currency: "RUB",
      expectedReturnPct: 11.2,
      volatilityPct: 14.4,
      liquidityDays: 3,
      maintenanceCostMonthly: 0,
      dividendIncomeMonthly: 42000,
      taxEffectPct: 13,
      isRealReturn: false,
      notes: "Диверсифицированный портфель под долгий горизонт",
      portfolioHoldings: [
        {
          id: crypto.randomUUID(),
          name: "Глобальные акции",
          sleeve: "EQUITY",
          currentValue: 6500000,
          expectedReturnPct: 12.5,
          dividendYieldPct: 2.4,
          growthRatePct: 6.5,
          volatilityPct: 18,
          targetWeightPct: 52,
          notes: null,
        },
        {
          id: crypto.randomUUID(),
          name: "Облигации",
          sleeve: "FIXED_INCOME",
          currentValue: 2600000,
          expectedReturnPct: 8,
          dividendYieldPct: 7.2,
          growthRatePct: 0,
          volatilityPct: 5,
          targetWeightPct: 21,
          notes: null,
        },
        {
          id: crypto.randomUUID(),
          name: "REIT / недвижимость",
          sleeve: "REAL_ESTATE",
          currentValue: 1500000,
          expectedReturnPct: 9.5,
          dividendYieldPct: 5.1,
          growthRatePct: 2.5,
          volatilityPct: 11,
          targetWeightPct: 12,
          notes: null,
        },
        {
          id: crypto.randomUUID(),
          name: "Золото и сырьё",
          sleeve: "COMMODITY",
          currentValue: 900000,
          expectedReturnPct: 6,
          dividendYieldPct: 0,
          growthRatePct: 0,
          volatilityPct: 13,
          targetWeightPct: 7,
          notes: null,
        },
        {
          id: crypto.randomUUID(),
          name: "Кэш",
          sleeve: "CASH_EQUIVALENT",
          currentValue: 1100000,
          expectedReturnPct: 5.2,
          dividendYieldPct: 4.8,
          growthRatePct: 0,
          volatilityPct: 1,
          targetWeightPct: 8,
          notes: null,
        },
      ],
    },
  });

  await prisma.asset.create({
    data: {
      userId,
      name: "ИИС",
      type: "IIS",
      assetClass: "INVESTMENT",
      currentValue: 2200000,
      currency: "RUB",
      expectedReturnPct: 9.4,
      volatilityPct: 10.2,
      liquidityDays: 10,
      maintenanceCostMonthly: 0,
      dividendIncomeMonthly: 8000,
      taxEffectPct: 13,
      isRealReturn: false,
      notes: "Консервативная часть капитала",
    },
  });

  await prisma.liability.create({
    data: {
      userId,
      name: "Ипотека",
      type: "MORTGAGE",
      remainingBalance: 2100000,
      interestRatePct: 8.4,
      monthlyPayment: 46000,
      urgency: "LOW",
      endDate: new Date("2033-06-01T00:00:00.000Z"),
      archivedAt: null,
      currency: "RUB",
    },
  });

  await prisma.income.create({
    data: {
      userId,
      name: "Зарплата",
      source: "SALARY",
      category: incomeCareer.id,
      amount: 420000,
      currency: "RUB",
      frequency: "MONTHLY",
      isEssential: true,
      taxRatePct: 13,
      growthRatePct: 8,
      startDate: null,
      endDate: null,
      oneTimeDate: null,
    },
  });
  await prisma.income.create({
    data: {
      userId,
      name: "Бонусы и фриланс",
      source: "BUSINESS",
      category: incomeCareer.id,
      amount: 90000,
      currency: "RUB",
      frequency: "MONTHLY",
      isEssential: false,
      taxRatePct: 6,
      growthRatePct: 4,
      startDate: null,
      endDate: null,
      oneTimeDate: null,
    },
  });
  await prisma.income.create({
    data: {
      userId,
      name: "Дивиденды и купоны",
      source: "PASSIVE",
      category: incomePassive.id,
      amount: 50000,
      currency: "RUB",
      frequency: "MONTHLY",
      isEssential: false,
      taxRatePct: 13,
      growthRatePct: 5,
      startDate: null,
      endDate: null,
      oneTimeDate: null,
    },
  });

  await prisma.expense.create({
    data: {
      userId,
      name: "Жильё и коммунальные",
      category: expenseHousing.id,
      amount: 120000,
      currency: "RUB",
      frequency: "MONTHLY",
      isEssential: true,
      growthRatePct: 5,
      oneTimeDate: null,
    },
  });
  await prisma.expense.create({
    data: {
      userId,
      name: "Питание и быт",
      category: expenseLifestyle.id,
      amount: 70000,
      currency: "RUB",
      frequency: "MONTHLY",
      isEssential: true,
      growthRatePct: 6,
      oneTimeDate: null,
    },
  });
  await prisma.expense.create({
    data: {
      userId,
      name: "Путешествия и отдых",
      category: expenseLifestyle.id,
      amount: 35000,
      currency: "RUB",
      frequency: "MONTHLY",
      isEssential: false,
      growthRatePct: 4,
      oneTimeDate: null,
    },
  });
  await prisma.expense.create({
    data: {
      userId,
      name: "Образование детей",
      category: expenseFamily.id,
      amount: 30000,
      currency: "RUB",
      frequency: "MONTHLY",
      isEssential: true,
      growthRatePct: 7,
      oneTimeDate: null,
    },
  });

  await prisma.goal.create({
    data: {
      userId,
      name: "Финансовая независимость",
      goalType: "RETIREMENT",
      targetAmountNominal: 45000000,
      targetDate: new Date("2046-01-01T00:00:00.000Z"),
      minAmount: 36000000,
      maxAmount: 52000000,
      stages: [],
      currency: "RUB",
      priority: 1,
      allowPartialFunding: true,
      strategy: "SYSTEMATIC",
      linkedAssetId: portfolio.id,
      pathSettings: {
        preferredKind: "CAPITAL",
        loanRatePct: 0,
        loanTermMonths: 0,
        downPaymentPct: 0,
      },
    },
  });
  await prisma.goal.create({
    data: {
      userId,
      name: "Подушка 12 месяцев",
      goalType: "EMERGENCY",
      targetAmountNominal: 2200000,
      targetDate: new Date("2027-06-01T00:00:00.000Z"),
      minAmount: 1800000,
      maxAmount: 2500000,
      stages: [],
      currency: "RUB",
      priority: 2,
      allowPartialFunding: true,
      strategy: "BALANCED",
      linkedAssetId: emergencyFund.id,
      pathSettings: {
        preferredKind: "SAVE",
        loanRatePct: 0,
        loanTermMonths: 0,
        downPaymentPct: 0,
      },
    },
  });
  await prisma.goal.create({
    data: {
      userId,
      name: "Обучение ребёнка",
      goalType: "EDUCATION",
      targetAmountNominal: 3000000,
      targetDate: new Date("2031-09-01T00:00:00.000Z"),
      minAmount: 2400000,
      maxAmount: 3600000,
      stages: [],
      currency: "RUB",
      priority: 3,
      allowPartialFunding: true,
      strategy: "SYSTEMATIC",
      linkedAssetId: portfolio.id,
      pathSettings: {
        preferredKind: "SAVE",
        loanRatePct: 12,
        loanTermMonths: 48,
        downPaymentPct: 15,
      },
    },
  });

  await seedPredefinedScenarios(userId);
  await prisma.scenario.create({
    data: {
      userId,
      name: "Ускоренное накопление",
      kind: "CUSTOM",
      templateKey: null,
      isActive: false,
      params: {
        monthlySavingDeltaPct: 15,
        bonusInvestSharePct: 70,
        retirementAgeShiftYears: -2,
      },
      rules: [],
    },
  });
}

async function copyMacro(sourceUserId: string, targetUserId: string): Promise<void> {
  const source = await prisma.macroSettings.findUnique({ where: { userId: sourceUserId } });
  if (!source) return;
  await prisma.macroSettings.upsert({
    where: { userId: targetUserId },
    create: {
      ...source,
      id: crypto.randomUUID(),
      userId: targetUserId,
      createdAt: now(),
      updatedAt: now(),
    },
    update: {
      baseCurrency: source.baseCurrency,
      baseInflationPct: source.baseInflationPct,
      incomeTaxPct: source.incomeTaxPct,
      planHorizonYears: source.planHorizonYears,
      discountRatePct: source.discountRatePct,
    },
  });
}

async function copyFinanceData(sourceUserId: string, targetUserId: string): Promise<void> {
  const snapshot = await loadUserFinanceSnapshot(sourceUserId);
  await wipeUserData(targetUserId);
  await copyMacro(sourceUserId, targetUserId);

  const categoryMap = new Map<string, string>();
  for (const category of snapshot.budgetCategories) {
    const created = await prisma.budgetCategory.create({
      data: {
        userId: targetUserId,
        name: category.name,
        kind: category.kind,
        monthlyLimit: category.monthlyLimit,
        sortOrder: category.sortOrder,
      },
    });
    categoryMap.set(category.id, created.id);
  }

  const assetMap = new Map<string, string>();
  for (const asset of snapshot.assets) {
    const created = await prisma.asset.create({
      data: cloneAsset(asset, targetUserId),
    });
    assetMap.set(asset.id, created.id);
  }

  for (const liability of snapshot.liabilities) {
    await prisma.liability.create({
      data: cloneLiability(liability, targetUserId),
    });
  }

  for (const income of snapshot.incomes) {
    await prisma.income.create({
      data: cloneIncome(income, targetUserId, categoryMap),
    });
  }

  for (const expense of snapshot.expenses) {
    await prisma.expense.create({
      data: cloneExpense(expense, targetUserId, categoryMap),
    });
  }

  for (const goal of snapshot.goals) {
    await prisma.goal.create({
      data: cloneGoal(goal, targetUserId, assetMap),
    });
  }

  for (const scenario of snapshot.scenarios) {
    await prisma.scenario.create({
      data: cloneScenario(scenario, targetUserId),
    });
  }
}

function cloneAsset(asset: Asset, userId: string) {
  return {
    userId,
    name: asset.name,
    type: asset.type,
    assetClass: asset.assetClass,
    currentValue: asset.currentValue,
    currency: asset.currency,
    expectedReturnPct: asset.expectedReturnPct,
    volatilityPct: asset.volatilityPct,
    liquidityDays: asset.liquidityDays,
    maintenanceCostMonthly: asset.maintenanceCostMonthly,
    dividendIncomeMonthly: asset.dividendIncomeMonthly,
    taxEffectPct: asset.taxEffectPct,
    isRealReturn: asset.isRealReturn,
    notes: asset.notes,
    portfolioHoldings: (asset.portfolioHoldings ?? []).map((holding) => ({
      ...holding,
      id: crypto.randomUUID(),
    })),
  };
}

function cloneLiability(liability: Liability, userId: string) {
  return {
    userId,
    name: liability.name,
    type: liability.type,
    remainingBalance: liability.remainingBalance,
    interestRatePct: liability.interestRatePct,
    monthlyPayment: liability.monthlyPayment,
    urgency: liability.urgency,
    endDate: liability.endDate,
    archivedAt: liability.archivedAt,
    currency: liability.currency,
  };
}

function cloneIncome(
  income: Income,
  userId: string,
  categoryMap: Map<string, string>,
) {
  return {
    userId,
    name: income.name,
    source: income.source,
    category: categoryMap.get(income.category) ?? income.category,
    amount: income.amount,
    currency: income.currency,
    frequency: income.frequency,
    isEssential: income.isEssential,
    taxRatePct: income.taxRatePct,
    growthRatePct: income.growthRatePct,
    startDate: income.startDate,
    endDate: income.endDate,
    oneTimeDate: income.oneTimeDate,
  };
}

function cloneExpense(
  expense: Expense,
  userId: string,
  categoryMap: Map<string, string>,
) {
  return {
    userId,
    name: expense.name,
    category: categoryMap.get(expense.category) ?? expense.category,
    amount: expense.amount,
    currency: expense.currency,
    frequency: expense.frequency,
    isEssential: expense.isEssential,
    growthRatePct: expense.growthRatePct,
    oneTimeDate: expense.oneTimeDate,
  };
}

function cloneGoal(goal: Goal, userId: string, assetMap: Map<string, string>) {
  return {
    userId,
    name: goal.name,
    goalType: goal.goalType,
    targetAmountNominal: goal.targetAmountNominal,
    targetDate: goal.targetDate,
    minAmount: goal.minAmount,
    maxAmount: goal.maxAmount,
    stages: goal.stages.map((stage) => ({
      ...stage,
      id: crypto.randomUUID(),
    })),
    currency: goal.currency,
    priority: goal.priority,
    allowPartialFunding: goal.allowPartialFunding,
    strategy: goal.strategy,
    linkedAssetId: goal.linkedAssetId ? (assetMap.get(goal.linkedAssetId) ?? null) : null,
    pathSettings: goal.pathSettings,
  };
}

function cloneScenario(scenario: Scenario, userId: string) {
  return {
    userId,
    name: scenario.name,
    kind: scenario.kind,
    templateKey: scenario.templateKey,
    isActive: scenario.isActive,
    params: scenario.params,
    rules: scenario.rules,
  };
}

async function ensureSandboxData(ownerUserId: string): Promise<string> {
  const targetUserId = demoUserId(ownerUserId);
  const ready = await redis.get<string>(sandboxReadyKey(ownerUserId));
  if (ready) return targetUserId;

  await ensureTemplateData();
  await copyFinanceData(DEMO_TEMPLATE_USER_ID, targetUserId);
  await redis.set(sandboxReadyKey(ownerUserId), "1");
  return targetUserId;
}

export async function recreateDemoMode(ownerUserId: string): Promise<DemoStatus> {
  const targetUserId = demoUserId(ownerUserId);
  await ensureTemplateData();
  await copyFinanceData(DEMO_TEMPLATE_USER_ID, targetUserId);
  await redis.set(sandboxReadyKey(ownerUserId), "1");
  await redis.set(activeDemoKey(ownerUserId), "1");
  return {
    active: true,
    hasSandbox: true,
    sandboxUserId: targetUserId,
  };
}

export async function resolveEffectiveUserId(ownerUserId: string): Promise<string> {
  const active = await redis.get<string>(activeDemoKey(ownerUserId));
  return active ? demoUserId(ownerUserId) : ownerUserId;
}

export async function getDemoStatus(ownerUserId: string): Promise<DemoStatus> {
  const [ready, active] = await Promise.all([
    redis.get<string>(sandboxReadyKey(ownerUserId)),
    redis.get<string>(activeDemoKey(ownerUserId)),
  ]);
  return {
    active: Boolean(active),
    hasSandbox: Boolean(ready),
    sandboxUserId: ready ? demoUserId(ownerUserId) : null,
  };
}

export async function activateDemoMode(ownerUserId: string): Promise<DemoStatus> {
  const sandboxId = await ensureSandboxData(ownerUserId);
  await redis.set(activeDemoKey(ownerUserId), "1");
  return {
    active: true,
    hasSandbox: true,
    sandboxUserId: sandboxId,
  };
}

export async function deactivateDemoMode(ownerUserId: string): Promise<void> {
  await redis.del(activeDemoKey(ownerUserId));
}

export async function removeDemoSandbox(ownerUserId: string): Promise<void> {
  const sandboxId = demoUserId(ownerUserId);
  await wipeUserData(sandboxId);
  await Promise.all([
    redis.del(activeDemoKey(ownerUserId)),
    redis.del(sandboxReadyKey(ownerUserId)),
  ]);
}
