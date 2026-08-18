import { NextResponse } from "next/server";
import {
  activateDemoMode,
  deactivateDemoMode,
  getDemoStatus,
  recreateDemoMode,
} from "@/modules/demo/demo-account.service";
import { isErrorResponse, requireViewerUserId } from "@/shared/session";

export async function GET() {
  const userId = await requireViewerUserId();
  if (isErrorResponse(userId)) return userId;
  return NextResponse.json(await getDemoStatus(userId));
}

export async function POST() {
  const userId = await requireViewerUserId();
  if (isErrorResponse(userId)) return userId;
  try {
    return NextResponse.json(await activateDemoMode(userId));
  } catch (e) {
    console.error("activate demo mode failed", e);
    return NextResponse.json(
      { error: "Не удалось открыть тестовый аккаунт" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const userId = await requireViewerUserId();
  if (isErrorResponse(userId)) return userId;
  await deactivateDemoMode(userId);
  return NextResponse.json({ ok: true });
}

export async function PUT() {
  const userId = await requireViewerUserId();
  if (isErrorResponse(userId)) return userId;
  try {
    return NextResponse.json(await recreateDemoMode(userId));
  } catch (e) {
    console.error("recreate demo mode failed", e);
    return NextResponse.json(
      { error: "Не удалось пересоздать тестовый аккаунт" },
      { status: 500 },
    );
  }
}
