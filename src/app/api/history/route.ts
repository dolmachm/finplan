import { NextResponse } from "next/server";
import { listRevisions } from "@/shared/revision";
import { requireUserId, isErrorResponse } from "@/shared/session";

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 40)));
  const items = await listRevisions(userId, limit);
  return NextResponse.json({ items });
}
