import { prisma } from "@/shared/db";
import type { AccountStatus, UserRole } from "@prisma/client";

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

  return prisma.$transaction(async (tx) => {
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
