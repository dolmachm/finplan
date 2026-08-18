import { NextResponse } from "next/server";
import { notFoundResponse } from "@/shared/api-validation";
import { requireViewerUserId, isErrorResponse } from "@/shared/session";
import { getTicketWithMessages } from "@/modules/support/support.service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const userId = await requireViewerUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await ctx.params;
  const data = await getTicketWithMessages(id);
  if (!data || data.ticket.userId !== userId) return notFoundResponse();
  return NextResponse.json(data);
}
