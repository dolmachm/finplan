import { prisma } from "@/shared/db";
import { shouldArchiveLiability } from "@/modules/finance/liability-status";
import type { Liability } from "@/shared/types";

/** Архивирует кредиты с истёкшим сроком — больше не участвуют в плане и платежах. */
export async function archiveExpiredLiabilities(
  liabilities: Liability[],
): Promise<Liability[]> {
  const now = new Date();
  const out: Liability[] = [];
  for (const l of liabilities) {
    if (!shouldArchiveLiability(l, now)) {
      out.push(l);
      continue;
    }
    const row = await prisma.liability.update({
      where: { id: l.id },
      data: { archivedAt: now },
    });
    out.push(row);
  }
  return out;
}
