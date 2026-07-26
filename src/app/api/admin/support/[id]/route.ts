import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/shared/admin-auth";
import { notFoundResponse, parseJsonBody } from "@/shared/api-validation";
import {
  getTicketWithMessages,
  updateTicketStatus,
} from "@/modules/support/support.service";
import { getUser } from "@/modules/admin/admin.service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if (auth !== true) return auth;
  const { id } = await ctx.params;
  const data = await getTicketWithMessages(id);
  if (!data) return notFoundResponse();
  const user = await getUser(data.ticket.userId);
  return NextResponse.json({
    ...data,
    userEmail: user?.email ?? null,
    userName: user?.name ?? null,
  });
}

const patchSchema = z.object({
  status: z.enum(["OPEN", "WAITING_USER", "CLOSED"]),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if (auth !== true) return auth;
  const { id } = await ctx.params;
  const parsed = parseJsonBody(patchSchema, await req.json().catch(() => ({})));
  if (!parsed.ok) return parsed.response;
  const ticket = await updateTicketStatus(id, parsed.data.status);
  if (!ticket) return notFoundResponse();
  return NextResponse.json({ ticket });
}
