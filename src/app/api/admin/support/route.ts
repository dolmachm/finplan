import { NextResponse } from "next/server";
import { requireAdmin } from "@/shared/admin-auth";
import { listTicketsByStatus } from "@/modules/support/support.service";
import { getUser } from "@/modules/admin/admin.service";
import type { SupportTicketStatus } from "@/shared/types";

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth !== true) return auth;

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") ?? "ALL";
  const status =
    statusParam === "ALL" ||
    statusParam === "OPEN" ||
    statusParam === "WAITING_USER" ||
    statusParam === "CLOSED"
      ? (statusParam as SupportTicketStatus | "ALL")
      : "ALL";

  const tickets = await listTicketsByStatus(status, 100);
  const enriched = await Promise.all(
    tickets.map(async (t) => {
      const user = await getUser(t.userId);
      return {
        ...t,
        userEmail: user?.email ?? null,
        userName: user?.name ?? null,
      };
    }),
  );

  return NextResponse.json({ tickets: enriched });
}
