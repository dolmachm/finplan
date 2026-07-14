import { NextResponse } from "next/server";
import { parseJsonBody, notFoundResponse } from "@/shared/api-validation";
import { resolveAssetClass } from "@/shared/finance-catalog";
import { assetSchema } from "@/shared/finance-schemas";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import { duplicateEntityResponse, isDuplicateAsset } from "@/shared/duplicate-check";
import { recordRevision } from "@/shared/revision";

const patchSchema = assetSchema.partial();

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;
  const current = await prisma.asset.findFirst({ where: { id, userId } });
  if (!current) {
    return notFoundResponse();
  }
  const parsed = parseJsonBody(patchSchema, await req.json());
  if (!parsed.ok) return parsed.response;
  const { assetClass, ...data } = parsed.data;
  const merged = {
    name: data.name ?? current.name,
    type: data.type ?? current.type,
  };
  const existing = await prisma.asset.findMany({ where: { userId } });
  if (isDuplicateAsset(existing, merged, id)) {
    return duplicateEntityResponse("Актив");
  }
  const resolvedClass = resolveAssetClass(data.type, assetClass);
  const asset = await prisma.asset.update({
    where: { id },
    data: { ...data, ...(resolvedClass ? { assetClass: resolvedClass } : {}) },
  });
  void recordRevision({
    userId,
    entityType: "asset",
    entityId: asset.id,
    action: "UPDATE",
    label: `Актив изменён: ${asset.name}`,
    before: current,
    after: asset,
  }).catch(() => {});
  return NextResponse.json(asset);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;
  const current = await prisma.asset.findFirst({ where: { id, userId } });
  if (!current) {
    return notFoundResponse();
  }
  await prisma.asset.delete({ where: { id } });
  void recordRevision({
    userId,
    entityType: "asset",
    entityId: id,
    action: "DELETE",
    label: `Актив удалён: ${current.name}`,
    before: current,
    after: null,
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}
