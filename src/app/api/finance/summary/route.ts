import { NextResponse } from "next/server";
import { loadUserFinanceSummary } from "@/modules/finance/finance-summary";
import { requireUserId, isErrorResponse } from "@/shared/session";

/** Итоговые метрики/скор для Home без полных списков сущностей. */
export async function GET() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const summary = await loadUserFinanceSummary(userId);
  return NextResponse.json(summary);
}
