import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/shared/api-validation";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import { assertOwned } from "@/shared/crud";
import { recordRevision } from "@/shared/revision";

const patchSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum([
      "MORTGAGE",
      "CONSUMER_LOAN",
      "CREDIT_CARD",
      "AUTO_LOAN",
      "STUDENT_LOAN",
      "OTHER",
    ]),
    remainingBalance: z.number().nonnegative(),
    interestRatePct: z.number(),
    monthlyPayment: z.number().nonnegative(),
    endDate: z.string().datetime().nullable().optional(),
    currency: z.string(),
  })
  .partial();

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;
  if (!(await assertOwned("liability", id, userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const current = await prisma.liability.findFirst({ where: { id, userId } });
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const parsed = parseJsonBody(patchSchema, await req.json());
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
  if (!(await assertOwned("liability", id, userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const current = await prisma.liability.findFirst({ where: { id, userId } });
  await prisma.liability.delete({ where: { id } });
  if (current) {
    await recordRevision({
      userId,
      entityType: "liability",
      entityId: id,
      action: "DELETE",
      label: `Пассив удалён: ${current.name}`,
      before: current,
      after: null,
    });
  }
  return NextResponse.json({ ok: true });
}
