import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/shared/db";

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

export async function getAccount(userId: string): Promise<AccountProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) return null;
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
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw new Error("NOT_FOUND");
  }

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
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const passwordHash =
    user && typeof user.passwordHash === "string" ? user.passwordHash : null;
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
