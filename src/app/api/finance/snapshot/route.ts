import { NextResponse } from "next/server";
import { loadUserFinanceSnapshot } from "@/modules/finance/finance-snapshot";
import { requireUserId, isErrorResponse } from "@/shared/session";

/** Полные сущности для вкладок Данные / План / Цели (лениво с клиента). */
export async function GET() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const snapshot = await loadUserFinanceSnapshot(userId);
  return NextResponse.json(snapshot);
}
