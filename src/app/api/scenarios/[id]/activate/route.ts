import { NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;

  const scenario = await prisma.scenario.findFirst({
    where: { id, userId },
  });
  if (!scenario) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.scenario.updateMany({
    where: { userId },
    data: { isActive: false },
  });
  await prisma.scenario.update({
    where: { id },
    data: { isActive: true },
  });

  return NextResponse.json({ ok: true });
}
