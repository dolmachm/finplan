import { NextResponse } from "next/server";
import { parseJsonBody } from "@/shared/api-validation";
import { liabilitySchema } from "@/shared/finance-schemas";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import { recordRevision } from "@/shared/revision";

export async function GET() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  return NextResponse.json(
    await prisma.liability.findMany({ where: { userId } }),
  );
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const parsed = parseJsonBody(liabilitySchema, await req.json());
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;
  const row = await prisma.liability.create({
    data: {
      ...data,
      userId,
      endDate: data.endDate ? new Date(data.endDate) : null,
    },
  });
  await recordRevision({
    userId,
    entityType: "liability",
    entityId: row.id,
    action: "CREATE",
    label: `Пассив добавлен: ${row.name}`,
    before: null,
    after: row,
  });
  return NextResponse.json(row, { status: 201 });
}
