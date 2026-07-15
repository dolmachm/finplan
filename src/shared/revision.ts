import type { EntityRevision } from "@/shared/types";
import { newId, now, setJson, reviveDates, getUserIds, addToUserIndex } from "@/shared/db/helpers";
import { redis } from "@/shared/redis";

export async function recordRevision(
  input: Omit<EntityRevision, "id" | "createdAt">,
): Promise<EntityRevision> {
  const row: EntityRevision = {
    id: newId(),
    createdAt: now(),
    ...input,
  };
  await setJson(`revision:${row.id}`, row);
  await addToUserIndex("revision", row.userId, row.id);
  await redis.lpush(`idx:revision:user:${row.userId}:chron`, row.id);
  await redis.ltrim(`idx:revision:user:${row.userId}:chron`, 0, 199);
  return row;
}

async function loadRevisionsByIds(ids: string[]): Promise<EntityRevision[]> {
  if (ids.length === 0) return [];
  const keys = ids.map((id) => `revision:${id}`);
  const rows = await redis.mget<EntityRevision[]>(...keys);
  return (rows ?? []).filter(Boolean).map((r) => reviveDates(r!));
}

export async function listRevisions(
  userId: string,
  limit = 50,
): Promise<EntityRevision[]> {
  const ids =
    (await redis.lrange(`idx:revision:user:${userId}:chron`, 0, limit - 1)) ??
    [];
  if (ids.length === 0) {
    const all = await getUserIds("revision", userId);
    const rows = await loadRevisionsByIds(all.slice(0, limit));
    return rows.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }
  return loadRevisionsByIds(ids);
}
