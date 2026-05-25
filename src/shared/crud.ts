import { prisma } from "@/shared/db";
import { z } from "zod";

export function ownedCreate<T extends { userId: string }>(
  userId: string,
  data: Omit<T, "userId">,
) {
  return { ...data, userId } as T;
}

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

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  return schema.parse(body);
}
