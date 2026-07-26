import { NextResponse } from "next/server";
import { startOver } from "@/modules/account/account.service";
import { notFoundResponse } from "@/shared/api-validation";
import { isErrorResponse, requireUserId } from "@/shared/session";

export async function POST() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  try {
    await startOver(userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return notFoundResponse();
    }
    console.error("start over failed", e);
    return NextResponse.json(
      { error: "Не удалось сбросить данные" },
      { status: 500 },
    );
  }
}
