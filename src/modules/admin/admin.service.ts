import { prisma, type Db } from "@/shared/db";
import type { AccountStatus, UserRole } from "@/shared/db";

export type FinanceEntityKind =
  | "asset"
  | "liability"
  | "income"
  | "expense"
  | "goal"
  | "macro";

const ENTITY_LABELS: Record<FinanceEntityKind, string> = {
  asset: "Актив",
  liability: "Обязательство",
  income: "Доход",
  expense: "Расход",
  goal: "Цель",
  macro: "Макропараметры",
};

export function financeEntityLabel(kind: FinanceEntityKind) {
  return ENTITY_LABELS[kind];
}

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      accountStatus: true,
      balance: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getUser(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      accountStatus: true,
      balance: true,
      createdAt: true,
      updatedAt: true,
      macroSettings: {
        select: {
          baseCurrency: true,
          baseInflationPct: true,
          incomeTaxPct: true,
          planHorizonYears: true,
        },
      },
      _count: {
        select: {
          assets: true,
          liabilities: true,
          incomes: true,
          expenses: true,
          goals: true,
          scenarios: true,
        },
      },
    },
  });
}

export async function getUserFinance(userId: string) {
  const [assets, liabilities, incomes, expenses, goals, macro] =
    await Promise.all([
      prisma.asset.findMany({ where: { userId } }),
      prisma.liability.findMany({ where: { userId } }),
      prisma.income.findMany({ where: { userId } }),
      prisma.expense.findMany({ where: { userId } }),
      prisma.goal.findMany({ where: { userId } }),
      prisma.macroSettings.findUnique({ where: { userId } }),
    ]);
  return { assets, liabilities, incomes, expenses, goals, macro };
}

export async function updateFinanceEntity(
  userId: string,
  kind: FinanceEntityKind,
  entityId: string,
  data: Record<string, unknown>,
) {
  const clean = { ...data };
  delete clean.id;
  delete clean.userId;
  delete clean.createdAt;

  if (kind === "macro") {
    return prisma.macroSettings.upsert({
      where: { userId },
      create: { userId, ...clean },
      update: clean,
    });
  }

  const repo = {
    asset: prisma.asset,
    liability: prisma.liability,
    income: prisma.income,
    expense: prisma.expense,
    goal: prisma.goal,
  }[kind];

  const existing = await repo.findFirst({ where: { id: entityId, userId } });
  if (!existing) throw new Error("NOT_FOUND");
  return repo.update({ where: { id: entityId }, data: clean });
}

export async function deleteFinanceEntity(
  userId: string,
  kind: Exclude<FinanceEntityKind, "macro">,
  entityId: string,
) {
  const repo = {
    asset: prisma.asset,
    liability: prisma.liability,
    income: prisma.income,
    expense: prisma.expense,
    goal: prisma.goal,
  }[kind];
  const existing = await repo.findFirst({ where: { id: entityId, userId } });
  if (!existing) throw new Error("NOT_FOUND");
  await repo.delete({ where: { id: entityId } });
  return existing;
}

export type UpdateUserInput = {
  email?: string;
  name?: string | null;
  role?: UserRole;
  accountStatus?: AccountStatus;
  balance?: number;
  baseCurrency?: string;
};

export async function updateUser(id: string, input: UpdateUserInput) {
  const { baseCurrency, ...userFields } = input;

  return prisma.$transaction(async (tx: Db) => {
    const user = await tx.user.update({
      where: { id },
      data: userFields,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        accountStatus: true,
        balance: true,
        updatedAt: true,
      },
    });

    if (baseCurrency !== undefined) {
      await tx.macroSettings.upsert({
        where: { userId: id },
        create: { userId: id, baseCurrency },
        update: { baseCurrency },
      });
    }

    return user;
  });
}

export async function adjustBalance(id: string, delta: number) {
  return prisma.user.update({
    where: { id },
    data: { balance: { increment: delta } },
    select: { id: true, balance: true },
  });
}

export async function setAccountStatus(id: string, status: AccountStatus) {
  return prisma.user.update({
    where: { id },
    data: { accountStatus: status },
    select: { id: true, accountStatus: true },
  });
}
