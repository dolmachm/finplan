import { prisma } from "@/shared/db";

export async function assertOwned(
  model: "asset" | "liability" | "income" | "expense" | "goal" | "scenario",
  id: string,
  userId: string,
): Promise<boolean> {
  const map = {
    asset: prisma.asset,
    liability: prisma.liability,
    income: prisma.income,
    expense: prisma.expense,
    goal: prisma.goal,
    scenario: prisma.scenario,
  } as const;
  const row = await (map[model] as { findFirst: (args: unknown) => Promise<{ userId: string } | null> }).findFirst({
    where: { id, userId },
  });
  return !!row;
}
