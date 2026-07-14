import type { EntityRevision } from "@/shared/types";
import { newId, now, setJson, getJson, getUserIds, addToUserIndex } from "@/shared/db/helpers";
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

export async function listRevisions(
  userId: string,
  limit = 50,
): Promise<EntityRevision[]> {
  const ids =
    (await redis.lrange(`idx:revision:user:${userId}:chron`, 0, limit - 1)) ??
    [];
  if (ids.length === 0) {
    // fallback to set index
    const all = await getUserIds("revision", userId);
    const rows: EntityRevision[] = [];
    for (const id of all.slice(0, limit)) {
      const row = await getJson<EntityRevision>(`revision:${id}`);
      if (row) rows.push(row);
    }
    return rows.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }
  const rows: EntityRevision[] = [];
  for (const id of ids) {
    const row = await getJson<EntityRevision>(`revision:${id}`);
    if (row) rows.push(row);
  }
  return rows;
}
