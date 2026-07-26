import type { Liability, LiabilityUrgency } from "@/shared/types";

export const URGENCY_RANK: Record<LiabilityUrgency, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

/** Активное обязательство: не в архиве и срок ещё не истёк. */
export function isLiabilityActive(
  l: Pick<Liability, "archivedAt" | "endDate">,
  asOf: Date = new Date(),
): boolean {
  if (l.archivedAt) return false;
  if (l.endDate && new Date(l.endDate).getTime() < asOf.getTime()) return false;
  return true;
}

export function activeLiabilities<T extends Pick<Liability, "archivedAt" | "endDate">>(
  list: T[],
  asOf: Date = new Date(),
): T[] {
  return list.filter((l) => isLiabilityActive(l, asOf));
}

/** Нужно ли перевести в архив по дате окончания. */
export function shouldArchiveLiability(
  l: Pick<Liability, "archivedAt" | "endDate">,
  asOf: Date = new Date(),
): boolean {
  return !l.archivedAt && !!l.endDate && new Date(l.endDate).getTime() < asOf.getTime();
}
