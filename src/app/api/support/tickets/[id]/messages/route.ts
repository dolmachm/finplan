import { NextResponse } from "next/server";
import { z } from "zod";
import { notFoundResponse, parseJsonBody } from "@/shared/api-validation";
import { requireViewerUserId, isErrorResponse } from "@/shared/session";
import { addUserMessage } from "@/modules/support/support.service";

const schema = z.object({
  body: z.string().trim().min(1).max(4000),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const userId = await requireViewerUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await ctx.params;
  const parsed = parseJsonBody(schema, await req.json().catch(() => ({})));
  if (!parsed.ok) return parsed.response;

  const result = await addUserMessage(id, userId, parsed.data.body);
  if (!result) return notFoundResponse();
  if ("error" in result && result.error === "closed") {
    return NextResponse.json(
      { error: "Обращение закрыто. Создайте новое, если проблема осталась." },
      { status: 409 },
    );
  }
  return NextResponse.json(result, { status: 201 });
}
