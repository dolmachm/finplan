import { redis } from "@/shared/redis";
import { newId, now, reviveDates, setJson } from "@/shared/db/helpers";

export type AdminActionLog = {
  id: string;
  targetUserId: string | null;
  action: string;
  label: string;
  detail: unknown | null;
  createdAt: Date;
};

const GLOBAL_KEY = "idx:adminLog:chron";
const MAX = 300;

export async function recordAdminAction(
  input: Omit<AdminActionLog, "id" | "createdAt">,
): Promise<AdminActionLog> {
  const row: AdminActionLog = {
    id: newId(),
    createdAt: now(),
    ...input,
  };
  await setJson(`adminLog:${row.id}`, row);
  await redis.lpush(GLOBAL_KEY, row.id);
  await redis.ltrim(GLOBAL_KEY, 0, MAX - 1);
  if (row.targetUserId) {
    await redis.lpush(`idx:adminLog:user:${row.targetUserId}:chron`, row.id);
    await redis.ltrim(`idx:adminLog:user:${row.targetUserId}:chron`, 0, 99);
  }
  return row;
}

async function loadByIds(ids: string[]): Promise<AdminActionLog[]> {
  if (ids.length === 0) return [];
  const rows = await redis.mget<AdminActionLog[]>(
    ...ids.map((id) => `adminLog:${id}`),
  );
  return (rows ?? []).filter(Boolean).map((r) => reviveDates(r!));
}

export async function listAdminActions(limit = 50, userId?: string) {
  const key = userId
    ? `idx:adminLog:user:${userId}:chron`
    : GLOBAL_KEY;
  const ids = (await redis.lrange(key, 0, limit - 1)) ?? [];
  return loadByIds(ids);
}
