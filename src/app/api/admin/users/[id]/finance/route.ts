import { notFoundResponse } from "@/shared/api-validation";
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAdminAction } from "@/modules/admin/admin-log";
import {
  deleteFinanceEntity,
  financeEntityLabel,
  getUser,
  getUserFinance,
  updateFinanceEntity,
  type FinanceEntityKind,
} from "@/modules/admin/admin.service";
import { requireAdmin } from "@/shared/admin-auth";
import { recordRevision } from "@/shared/revision";

const kindSchema = z.enum(["asset", "liability", "income", "expense", "goal", "macro"]);

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (auth !== true) return auth;

  const { id } = await params;
  const user = await getUser(id);
  if (!user) return notFoundResponse();

  const finance = await getUserFinance(id);
  return NextResponse.json({ finance });
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (auth !== true) return auth;

  const { id: userId } = await params;
  const body = await req.json().catch(() => null);
  const kind = kindSchema.safeParse(body?.kind);
  if (!kind.success || !body?.entityId || typeof body.data !== "object" || !body.data) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const entity = await updateFinanceEntity(
      userId,
      kind.data as FinanceEntityKind,
      String(body.entityId),
      body.data as Record<string, unknown>,
    );
    const name =
      entity && typeof entity === "object" && "name" in entity
        ? String((entity as { name?: string }).name ?? "")
        : "";
    const label = `Админ изменил ${financeEntityLabel(kind.data)}${name ? `: ${name}` : ""}`;
    void recordAdminAction({
      targetUserId: userId,
      action: "FINANCE_UPDATE",
      label,
      detail: { kind: kind.data, entityId: body.entityId },
    }).catch(() => {});
    if (kind.data !== "macro") {
      void recordRevision({
        userId,
        entityType: kind.data,
        entityId: String(body.entityId),
        action: "UPDATE",
        label,
        before: null,
        after: entity,
      }).catch(() => {});
    } else {
      void recordRevision({
        userId,
        entityType: "macro",
        entityId: userId,
        action: "UPDATE",
        label,
        before: null,
        after: entity,
      }).catch(() => {});
    }
    return NextResponse.json({ entity });
  } catch {
    return notFoundResponse();
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (auth !== true) return auth;

  const { id: userId } = await params;
  const url = new URL(req.url);
  const kindRaw = url.searchParams.get("kind");
  const entityId = url.searchParams.get("entityId");
  const kind = kindSchema.safeParse(kindRaw);
  if (!kind.success || kind.data === "macro" || !entityId) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  try {
    const existing = await deleteFinanceEntity(userId, kind.data, entityId);
    const name =
      existing && typeof existing === "object" && "name" in existing
        ? String((existing as { name?: string }).name ?? "")
        : "";
    const label = `Админ удалил ${financeEntityLabel(kind.data)}${name ? `: ${name}` : ""}`;
    void recordAdminAction({
      targetUserId: userId,
      action: "FINANCE_DELETE",
      label,
      detail: { kind: kind.data, entityId },
    }).catch(() => {});
    void recordRevision({
      userId,
      entityType: kind.data,
      entityId,
      action: "DELETE",
      label,
      before: existing,
      after: null,
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch {
    return notFoundResponse();
  }
}
