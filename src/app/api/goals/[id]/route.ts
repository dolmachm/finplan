import { NextResponse } from "next/server";
import { parseJsonBody, notFoundResponse } from "@/shared/api-validation";
import { goalPatchSchema } from "@/shared/finance-schemas";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import { duplicateEntityResponse, isDuplicateGoal } from "@/shared/duplicate-check";
import { recordRevision } from "@/shared/revision";

const patchSchema = goalPatchSchema;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;
  const current = await prisma.goal.findFirst({ where: { id, userId } });
  if (!current) {
    return notFoundResponse();
  }
  const parsed = parseJsonBody(patchSchema, await req.json());
  if (!parsed.ok) return parsed.response;
  const { targetDate, stages, ...rest } = parsed.data;
  const mergedDate = targetDate ? new Date(targetDate) : current.targetDate;
  const existing = await prisma.goal.findMany({ where: { userId } });
  if (
    isDuplicateGoal(
      existing,
      {
        name: rest.name ?? current.name,
        goalType: rest.goalType ?? current.goalType ?? "OTHER",
        targetAmountNominal: rest.targetAmountNominal ?? current.targetAmountNominal,
        targetDate: mergedDate,
      },
      id,
    )
  ) {
    return duplicateEntityResponse("Цель");
  }
  const row = await prisma.goal.update({
    where: { id },
    data: {
      ...rest,
      ...(targetDate ? { targetDate: mergedDate } : {}),
      ...(stages
        ? {
            stages: stages.map((s) => ({
              ...s,
              targetDate: new Date(s.targetDate),
            })),
          }
        : {}),
    },
  });
  await recordRevision({
    userId,
    entityType: "goal",
    entityId: row.id,
    action: "UPDATE",
    label: `Цель изменена: ${row.name}`,
    before: current,
    after: row,
  });
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;
  const current = await prisma.goal.findFirst({ where: { id, userId } });
  if (!current) {
    return notFoundResponse();
  }
  await prisma.goal.delete({ where: { id } });
  await recordRevision({
    userId,
    entityType: "goal",
    entityId: id,
    action: "DELETE",
    label: `Цель удалена: ${current.name}`,
    before: current,
    after: null,
  });
  return NextResponse.json({ ok: true });
}
