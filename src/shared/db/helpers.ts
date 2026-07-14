import { redis } from "@/shared/redis";

export function newId(): string {
  return crypto.randomUUID();
}

export function now(): Date {
  return new Date();
}

const DATE_FIELDS = new Set([
  "createdAt", "updatedAt", "emailVerified", "endDate", "startDate",
  "oneTimeDate", "targetDate", "computedAt", "startedAt", "completedAt", "expires",
]);

export function reviveDates<T>(obj: T): T {
  if (!obj || typeof obj !== "object") return obj;
  const result = { ...obj } as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    if (DATE_FIELDS.has(key) && typeof result[key] === "string") {
      result[key] = new Date(result[key] as string);
    }
  }
  return result as T;
}

export function serialize<T>(obj: T): T {
  if (!obj || typeof obj !== "object") return obj;
  const result = { ...obj } as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    if (result[key] instanceof Date) {
      result[key] = (result[key] as Date).toISOString();
    }
  }
  return result as T;
}

export async function getJson<T>(key: string): Promise<T | null> {
  const raw = await redis.get<T>(key);
  return raw ? reviveDates(raw) : null;
}

export async function setJson<T>(key: string, value: T): Promise<void> {
  await redis.set(key, serialize(value));
}

export async function delKey(key: string): Promise<void> {
  await redis.del(key);
}

export async function getUserIds(entity: string, userId: string): Promise<string[]> {
  return (await redis.smembers(`idx:${entity}:user:${userId}`)) ?? [];
}

export async function addToUserIndex(entity: string, userId: string, id: string): Promise<void> {
  await redis.sadd(`idx:${entity}:user:${userId}`, id);
}

export async function removeFromUserIndex(entity: string, userId: string, id: string): Promise<void> {
  await redis.srem(`idx:${entity}:user:${userId}`, id);
}

export async function getManyByUser<T extends { id: string; userId: string }>(
  entity: string,
  userId: string,
): Promise<T[]> {
  const ids = await getUserIds(entity, userId);
  if (ids.length === 0) return [];
  const keys = ids.map((id) => `${entity}:${id}`);
  const rows = await redis.mget<T[]>(...keys);
  return (rows ?? []).filter(Boolean).map((r) => reviveDates(r!));
}

type WhereFilter = Record<string, unknown>;

export function matchesWhere<T extends Record<string, unknown>>(row: T, where: WhereFilter): boolean {
  for (const [key, val] of Object.entries(where)) {
    if (val && typeof val === "object" && "gte" in (val as object)) {
      const gte = (val as { gte: Date }).gte;
      const rowDate = row[key] as Date | null;
      if (!(rowDate instanceof Date) || rowDate < gte) return false;
      continue;
    }
    if (row[key] !== val) return false;
  }
  return true;
}

export function applySelect<T extends Record<string, unknown>>(
  row: T,
  select?: Record<string, boolean>,
): Partial<T> | T {
  if (!select) return row;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(select)) {
    if (select[key]) result[key] = row[key];
  }
  return result as Partial<T>;
}

export function sortBy<T>(rows: T[], orderBy: Record<string, "asc" | "desc">): T[] {
  const [field, dir] = Object.entries(orderBy)[0] ?? [];
  if (!field) return rows;
  return [...rows].sort((a, b) => {
    const av = (a as Record<string, unknown>)[field];
    const bv = (b as Record<string, unknown>)[field];
    const cmp = av instanceof Date && bv instanceof Date
      ? av.getTime() - bv.getTime()
      : String(av).localeCompare(String(bv));
    return dir === "desc" ? -cmp : cmp;
  });
}

export async function countByUser<T extends { id: string; userId: string }>(
  entity: string,
  userId: string,
  where?: WhereFilter,
): Promise<number> {
  const rows = await getManyByUser<T>(entity, userId);
  if (!where) return rows.length;
  return rows.filter((r) => matchesWhere(r, where)).length;
}

export async function findFirstByUser<T extends { id: string; userId: string }>(
  entity: string,
  where: WhereFilter,
  opts?: { orderBy?: Record<string, "asc" | "desc"> },
): Promise<T | null> {
  const userId = where.userId as string;
  let rows = await getManyByUser<T>(entity, userId);
  rows = rows.filter((r) => matchesWhere(r, where));
  if (opts?.orderBy) rows = sortBy(rows, opts.orderBy);
  return rows[0] ?? null;
}

export async function countAll<T extends { id: string; userId: string }>(
  entity: string,
  where?: WhereFilter,
): Promise<number> {
  if (where?.status) {
    const ids = (await redis.smembers(`idx:${entity}:status:${where.status}`)) ?? [];
    if (!where.createdAt) return ids.length;
    let count = 0;
    for (const id of ids) {
      const row = await getJson<T>(`${entity}:${id}`);
      if (row && matchesWhere(row, where)) count++;
    }
    return count;
  }
  const userIds = (await redis.smembers("idx:users")) ?? [];
  let total = 0;
  for (const uid of userIds) {
    total += await countByUser<T>(entity, uid, where);
  }
  return total;
}

export async function findFirstGlobal<T extends { id: string; userId: string }>(
  entity: string,
  where: WhereFilter,
  opts?: { orderBy?: Record<string, "asc" | "desc"> },
): Promise<T | null> {
  if (where.status === "PENDING") {
    const id = await redis.lindex(`idx:${entity}:pending`, 0);
    if (!id) return null;
    return getJson<T>(`${entity}:${id}`);
  }
  const userIds = (await redis.smembers("idx:users")) ?? [];
  const all: T[] = [];
  for (const uid of userIds) {
    const rows = await getManyByUser<T>(entity, uid);
    all.push(...rows.filter((r) => matchesWhere(r, where)));
  }
  const sorted = opts?.orderBy ? sortBy(all, opts.orderBy) : all;
  return sorted[0] ?? null;
}

export async function findManyGlobal<T extends { id: string; userId: string }>(
  entity: string,
  where?: WhereFilter,
  opts?: { orderBy?: Record<string, "asc" | "desc">; take?: number },
): Promise<T[]> {
  const userIds = (await redis.smembers("idx:users")) ?? [];
  const all: T[] = [];
  for (const uid of userIds) {
    const rows = await getManyByUser<T>(entity, uid);
    all.push(...(where ? rows.filter((r) => matchesWhere(r, where)) : rows));
  }
  let result = opts?.orderBy ? sortBy(all, opts.orderBy) : all;
  if (opts?.take) result = result.slice(0, opts.take);
  return result;
}

export async function createEntity<T extends { id: string; userId: string; createdAt?: Date; updatedAt?: Date }>(
  entity: string,
  data: T,
  extra?: (row: T) => Promise<void>,
): Promise<T> {
  const ts = now();
  const row = {
    ...data,
    id: data.id ?? newId(),
    createdAt: data.createdAt ?? ts,
    updatedAt: data.updatedAt ?? ts,
  } as T;
  await setJson(`${entity}:${row.id}`, row);
  await addToUserIndex(entity, row.userId, row.id);
  if (extra) await extra(row);
  return row;
}

export async function updateEntity<T extends { id: string }>(
  entity: string,
  id: string,
  data: Partial<T>,
): Promise<T> {
  const existing = await getJson<T>(`${entity}:${id}`);
  if (!existing) throw new Error(`${entity} not found: ${id}`);
  const updated = { ...existing, ...data, updatedAt: now() } as T;
  await setJson(`${entity}:${id}`, updated);
  return updated;
}

export async function deleteEntity(entity: string, id: string, userId: string): Promise<void> {
  await delKey(`${entity}:${id}`);
  await removeFromUserIndex(entity, userId, id);
}
