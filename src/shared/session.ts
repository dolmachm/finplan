import { auth } from "@/shared/auth";
import { NextResponse } from "next/server";
import { unauthorizedResponse } from "@/shared/api-validation";

export async function requireUserId(): Promise<string | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }
  return session.user.id;
}

export function isErrorResponse(v: string | NextResponse): v is NextResponse {
  return v instanceof NextResponse;
}
