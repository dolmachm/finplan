import { handlers } from "@/shared/auth";
import { isAuthConfigured } from "@/shared/auth.config";
import { type NextRequest, NextResponse } from "next/server";

function authNotConfigured() {
  return NextResponse.json(
    {
      error: "Auth not configured",
      fix: "Add AUTH_SECRET to Vercel Environment Variables and redeploy",
    },
    { status: 503 },
  );
}

export async function GET(req: NextRequest) {
  if (!isAuthConfigured()) return authNotConfigured();
  return handlers.GET(req);
}

export async function POST(req: NextRequest) {
  if (!isAuthConfigured()) return authNotConfigured();
  return handlers.POST(req);
}
