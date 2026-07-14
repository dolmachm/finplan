import { notFoundResponse } from "@/shared/api-validation";
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
    return notFoundResponse();
  }
  return NextResponse.json(job);
}
