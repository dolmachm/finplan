import { NextResponse } from "next/server";
import { parseJsonBody } from "@/shared/api-validation";
import { goalSchema } from "@/shared/finance-schemas";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import { duplicateEntityResponse, isDuplicateGoal } from "@/shared/duplicate-check";
import { recordRevision } from "@/shared/revision";

export async function GET() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const rows = await prisma.goal.findMany({
    where: { userId },
    orderBy: { priority: "asc" },
  });
  return NextResponse.json(
    rows.map((g) => ({
      ...g,
      minAmount: g.minAmount ?? null,
      maxAmount: g.maxAmount ?? null,
      stages: g.stages ?? [],
      pathSettings: g.pathSettings ?? null,
    })),
  );
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const parsed = parseJsonBody(goalSchema, await req.json());
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;
  const targetDate = new Date(data.targetDate);
  const existing = await prisma.goal.findMany({ where: { userId } });
  if (
    isDuplicateGoal(existing, {
      name: data.name,
      goalType: data.goalType,
      targetAmountNominal: data.targetAmountNominal,
      targetDate,
    })
  ) {
    return duplicateEntityResponse("Цель");
  }
  const row = await prisma.goal.create({
    data: {
      ...data,
      userId,
      targetDate,
      linkedAssetId: data.linkedAssetId ?? null,
      minAmount: data.minAmount ?? null,
      maxAmount: data.maxAmount ?? null,
      stages: (data.stages ?? []).map((s) => ({
        ...s,
        targetDate: new Date(s.targetDate),
      })),
      pathSettings: data.pathSettings ?? null,
    },
  });
  await recordRevision({
    userId,
    entityType: "goal",
    entityId: row.id,
    action: "CREATE",
    label: `Цель создана: ${row.name}`,
    before: null,
    after: row,
  });
  return NextResponse.json(row, { status: 201 });
}
