import { NextResponse } from "next/server";
import { listAdminActions } from "@/modules/admin/admin-log";
import { requireAdmin } from "@/shared/admin-auth";

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth !== true) return auth;

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
  const items = await listAdminActions(limit);
  return NextResponse.json({ items });
}
