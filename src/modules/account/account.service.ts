import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/shared/db";
import {
  delKey,
  deleteEntity,
  getJson,
  getUserIds,
  now,
  setJson,
} from "@/shared/db/helpers";
import { redis } from "@/shared/redis";
import type { MacroSettings, SimulationJob, User } from "@/shared/types";
import { seedPredefinedScenarios } from "@/modules/simulation/simulation.service";

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === undefined ? undefined : v.length ? v : null))
    .pipe(z.string().min(1).nullable().optional()),
  email: z.string().trim().email().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export type AccountProfile = {
  id: string;
  email: string;
  name: string | null;
};

const CRUD_ENTITIES = [
  "asset",
  "liability",
  "income",
  "expense",
  "goal",
  "budgetCategory",
  "scenario",
  "planSnapshot",
] as const;

async function requireActiveUser(userId: string): Promise<User> {
  const user = (await prisma.user.findUnique({ where: { id: userId } })) as User | null;
  if (!user || user.deletedAt) {
    throw new Error("NOT_FOUND");
  }
  return user;
}

/** Удаляет финансовые и плановые данные пользователя (запись User не трогает). */
export async function wipeUserData(userId: string): Promise<void> {
  for (const entity of CRUD_ENTITIES) {
    const ids = await getUserIds(entity, userId);
    for (const id of ids) {
      await deleteEntity(entity, id, userId);
    }
  }

  const jobIds = await getUserIds("simJob", userId);
  for (const id of jobIds) {
    const job = await getJson<SimulationJob>(`simJob:${id}`);
    if (job) {
      await redis.srem(`idx:simJob:status:${job.status}`, id);
      if (job.status === "PENDING") {
        await redis.lrem(`idx:simJob:pending`, 0, id);
      }
    }
    await delKey(`simResult:${id}`);
    await deleteEntity("simJob", id, userId);
  }

  const revisionIds = await getUserIds("revision", userId);
  for (const id of revisionIds) {
    await delKey(`revision:${id}`);
    await redis.srem(`idx:revision:user:${userId}`, id);
  }
  await delKey(`idx:revision:user:${userId}:chron`);

  await delKey(`macro:${userId}`);
  await delKey(`iplan:${userId}`);
}

async function resetMacroDefaults(userId: string): Promise<void> {
  const ts = now();
  const macro: MacroSettings = {
    id: crypto.randomUUID(),
    userId,
    baseCurrency: "RUB",
    baseInflationPct: 4,
    incomeTaxPct: 13,
    planHorizonYears: 30,
    discountRatePct: null,
    createdAt: ts,
    updatedAt: ts,
  };
  await setJson(`macro:${userId}`, macro);
}

export async function getAccount(userId: string): Promise<AccountProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, deletedAt: true },
  });
  if (!user || user.deletedAt) return null;
  return {
    id: user.id as string,
    email: user.email as string,
    name: (user.name as string | null) ?? null,
  };
}

export async function updateProfile(
  userId: string,
  input: z.infer<typeof updateProfileSchema>,
): Promise<AccountProfile> {
  const existing = await requireActiveUser(userId);

  if (input.email && input.email !== existing.email) {
    const taken = await prisma.user.findUnique({ where: { email: input.email } });
    if (taken && taken.id !== userId) {
      throw new Error("EMAIL_EXISTS");
    }
  }

  const data: { name?: string | null; email?: string } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.email !== undefined) data.email = input.email;

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, email: true, name: true },
  });

  return {
    id: updated.id as string,
    email: updated.email as string,
    name: (updated.name as string | null) ?? null,
  };
}

export async function changePassword(
  userId: string,
  input: z.infer<typeof changePasswordSchema>,
): Promise<void> {
  const user = await requireActiveUser(userId);
  const passwordHash =
    typeof user.passwordHash === "string" ? user.passwordHash : null;
  if (!passwordHash) {
    throw new Error("NOT_FOUND");
  }

  const valid = await bcrypt.compare(input.currentPassword, passwordHash);
  if (!valid) {
    throw new Error("INVALID_PASSWORD");
  }

  const nextHash = await bcrypt.hash(input.newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: nextHash },
  });
}

/** Сброс всех финансовых данных; аккаунт и вход сохраняются. */
export async function startOver(userId: string): Promise<void> {
  await requireActiveUser(userId);
  await wipeUserData(userId);
  await resetMacroDefaults(userId);
  await seedPredefinedScenarios(userId);
}

/**
 * Soft-delete: данные профиля удаляются, запись User остаётся с deletedAt.
 * Email освобождается для новой регистрации; вход по этому аккаунту невозможен.
 */
export async function softDeleteAccount(userId: string): Promise<void> {
  const user = await requireActiveUser(userId);
  await wipeUserData(userId);

  await redis.del(`idx:user:email:${user.email}`);
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: null,
      image: null,
      deletedAt: now(),
    },
  });
}
