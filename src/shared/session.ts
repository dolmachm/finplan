import { auth } from "@/shared/auth";
import { NextResponse } from "next/server";

export async function requireUserId(): Promise<string | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session.user.id;
}

export function isErrorResponse(v: string | NextResponse): v is NextResponse {
  return v instanceof NextResponse;
}
