import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/shared/admin-auth";
import { notFoundResponse, parseJsonBody } from "@/shared/api-validation";
import { addAdminMessage } from "@/modules/support/support.service";

const schema = z.object({
  body: z.string().trim().min(1).max(4000),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if (auth !== true) return auth;
  const { id } = await ctx.params;
  const parsed = parseJsonBody(schema, await req.json().catch(() => ({})));
  if (!parsed.ok) return parsed.response;

  const result = await addAdminMessage(id, parsed.data.body);
  if (!result) return notFoundResponse();
  if ("error" in result && result.error === "closed") {
    return NextResponse.json(
      { error: "Тикет закрыт. Сначала смените статус." },
      { status: 409 },
    );
  }
  return NextResponse.json(result, { status: 201 });
}
