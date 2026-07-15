import { NextResponse } from "next/server";
import { parseJsonBody, notFoundResponse } from "@/shared/api-validation";
import { liabilityPatchSchema } from "@/shared/finance-schemas";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import { recordRevision } from "@/shared/revision";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;
  const current = await prisma.liability.findFirst({ where: { id, userId } });
  if (!current) {
    return notFoundResponse();
  }
  const parsed = parseJsonBody(liabilityPatchSchema, await req.json());
  if (!parsed.ok) return parsed.response;
  const { endDate, ...rest } = parsed.data;
  const row = await prisma.liability.update({
    where: { id },
    data: {
      ...rest,
      ...(endDate !== undefined
        ? { endDate: endDate ? new Date(endDate) : null }
        : {}),
    },
  });
  await recordRevision({
    userId,
    entityType: "liability",
    entityId: row.id,
    action: "UPDATE",
    label: `Пассив изменён: ${row.name}`,
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
  const current = await prisma.liability.findFirst({ where: { id, userId } });
  if (!current) {
    return notFoundResponse();
  }
  await prisma.liability.delete({ where: { id } });
  await recordRevision({
    userId,
    entityType: "liability",
    entityId: id,
    action: "DELETE",
    label: `Пассив удалён: ${current.name}`,
    before: current,
    after: null,
  });
  return NextResponse.json({ ok: true });
}
