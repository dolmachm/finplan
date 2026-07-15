import { NextResponse } from "next/server";
import { listAdminActions } from "@/modules/admin/admin-log";
import { getUser } from "@/modules/admin/admin.service";
import { requireAdmin } from "@/shared/admin-auth";
import { listRevisions } from "@/shared/revision";
import { notFoundResponse } from "@/shared/api-validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (auth !== true) return auth;

  const { id } = await params;
  const user = await getUser(id);
  if (!user) return notFoundResponse();

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 40)));

  const [userHistory, adminHistory] = await Promise.all([
    listRevisions(id, limit),
    listAdminActions(limit, id),
  ]);

  const merged = [
    ...userHistory.map((r) => ({
      id: r.id,
      source: "user" as const,
      label: r.label,
      meta: `${r.entityType} · ${r.action}`,
      createdAt: r.createdAt,
      detail: { before: r.before, after: r.after },
    })),
    ...adminHistory.map((r) => ({
      id: r.id,
      source: "admin" as const,
      label: r.label,
      meta: r.action,
      createdAt: r.createdAt,
      detail: r.detail,
    })),
  ].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return NextResponse.json({ items: merged.slice(0, limit) });
}
