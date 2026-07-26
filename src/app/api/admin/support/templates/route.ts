import { NextResponse } from "next/server";
import { requireAdmin } from "@/shared/admin-auth";
import { ADMIN_QUICK_REPLIES } from "@/content/support";

export async function GET() {
  const auth = await requireAdmin();
  if (auth !== true) return auth;
  return NextResponse.json({ templates: ADMIN_QUICK_REPLIES });
}
