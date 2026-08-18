import { auth } from "@/shared/auth";
import { NextResponse } from "next/server";
import { unauthorizedResponse } from "@/shared/api-validation";
import { resolveEffectiveUserId } from "@/modules/demo/demo-account.service";

export type SessionContext = {
  viewerUserId: string;
  effectiveUserId: string;
  demoMode: boolean;
};

export async function requireUserId(): Promise<string | NextResponse> {
  const ctx = await requireSessionContext();
  if (isErrorResponse(ctx)) return ctx;
  return ctx.effectiveUserId;
}

export async function requireViewerUserId(): Promise<string | NextResponse> {
  const ctx = await requireSessionContext();
  if (isErrorResponse(ctx)) return ctx;
  return ctx.viewerUserId;
}

export async function requireSessionContext(): Promise<SessionContext | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }
  const viewerUserId = session.user.id;
  const effectiveUserId = await resolveEffectiveUserId(viewerUserId);
  return {
    viewerUserId,
    effectiveUserId,
    demoMode: effectiveUserId !== viewerUserId,
  };
}

export function isErrorResponse(
  v: string | NextResponse | SessionContext,
): v is NextResponse {
  return v instanceof NextResponse;
}
