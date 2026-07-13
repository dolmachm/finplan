import { NextResponse } from "next/server";
import { prisma } from "@/shared/db";
import { requireAdmin } from "@/shared/admin-auth";

export async function GET() {
  const auth = await requireAdmin();
  if (auth !== true) return auth;

  const [pending, running, failed, completedToday] = await Promise.all([
    prisma.simulationJob.count({ where: { status: "PENDING" } }),
    prisma.simulationJob.count({ where: { status: "RUNNING" } }),
    prisma.simulationJob.count({ where: { status: "FAILED" } }),
    prisma.simulationJob.count({
      where: {
        status: "COMPLETED",
        completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
  ]);

  const recent = await prisma.simulationJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      userId: true,
      status: true,
      progressPct: true,
      numRuns: true,
      createdAt: true,
      completedAt: true,
      errorMessage: true,
    },
  });

  return NextResponse.json({
    queue: { pending, running, failed, completedToday },
    recent,
  });
}
