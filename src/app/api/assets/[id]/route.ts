import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/shared/api-validation";
import { ASSET_TYPE_OPTIONS } from "@/shared/finance-catalog";
import { assetSchema } from "@/shared/finance-schemas";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import { assertOwned } from "@/shared/crud";
import { duplicateEntityResponse, isDuplicateAsset } from "@/shared/duplicate-check";
import { recordRevision } from "@/shared/revision";

const patchSchema = assetSchema.partial();

function resolveAssetClass(
  type: z.infer<typeof assetSchema>["type"] | undefined,
  assetClass?: "PERSONAL" | "INVESTMENT",
) {
  if (assetClass) return assetClass;
  if (!type) return undefined;
  return ASSET_TYPE_OPTIONS.find((o) => o.value === type)?.class ?? "PERSONAL";
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;
  if (!(await assertOwned("asset", id, userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const current = await prisma.asset.findFirst({ where: { id, userId } });
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
  await recordRevision({
    userId,
    entityType: "asset",
    entityId: asset.id,
    action: "UPDATE",
    label: `Актив изменён: ${asset.name}`,
    before: current,
    after: asset,
  });
  return NextResponse.json(asset);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;
  if (!(await assertOwned("asset", id, userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const current = await prisma.asset.findFirst({ where: { id, userId } });
  await prisma.asset.delete({ where: { id } });
  if (current) {
    await recordRevision({
      userId,
      entityType: "asset",
      entityId: id,
      action: "DELETE",
      label: `Актив удалён: ${current.name}`,
      before: current,
      after: null,
    });
  }
  return NextResponse.json({ ok: true });
}
