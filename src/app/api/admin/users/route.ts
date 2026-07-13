import { NextResponse } from "next/server";
import { listUsers } from "@/modules/admin/admin.service";
import { isAdminAuthenticated, requireAdmin } from "@/shared/admin-auth";

export async function GET() {
  const auth = await requireAdmin();
  if (auth !== true) return auth;
  const users = await listUsers();
  return NextResponse.json({ users });
}

export async function HEAD() {
  const ok = await isAdminAuthenticated();
  return new NextResponse(null, { status: ok ? 200 : 401 });
}
