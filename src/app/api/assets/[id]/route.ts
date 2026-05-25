import { NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import { assertOwned } from "@/shared/crud";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;
  if (!(await assertOwned("asset", id, userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.asset.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
