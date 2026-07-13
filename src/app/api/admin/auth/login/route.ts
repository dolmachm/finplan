import { NextResponse } from "next/server";
import {
  createAdminToken,
  setAdminCookie,
  verifyAdminCredentials,
} from "@/shared/admin-auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const login = body?.login as string | undefined;
  const password = body?.password as string | undefined;

  if (!login || !password || !verifyAdminCredentials(login, password)) {
    return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  setAdminCookie(res, createAdminToken());
  return res;
}
