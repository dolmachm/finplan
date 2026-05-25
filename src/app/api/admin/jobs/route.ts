import { NextResponse } from "next/server";
import { auth } from "@/shared/auth";
import { prisma } from "@/shared/db";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
