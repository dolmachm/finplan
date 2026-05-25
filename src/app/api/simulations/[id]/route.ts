import { NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;
  const job = await prisma.simulationJob.findFirst({
    where: { id, userId },
    include: { result: true },
  });
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(job);
}
