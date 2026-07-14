import { NextResponse } from "next/server";
import { parseJsonBody } from "@/shared/api-validation";
import { resolveAssetClass } from "@/shared/finance-catalog";
import { assetSchema } from "@/shared/finance-schemas";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import { duplicateEntityResponse, isDuplicateAsset } from "@/shared/duplicate-check";
import { recordRevision } from "@/shared/revision";

export async function GET() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const assets = await prisma.asset.findMany({ where: { userId } });
  return NextResponse.json(assets);
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const parsed = parseJsonBody(assetSchema, await req.json());
  if (!parsed.ok) return parsed.response;
  const { assetClass, ...data } = parsed.data;
  const existing = await prisma.asset.findMany({ where: { userId } });
  if (isDuplicateAsset(existing, data)) {
    return duplicateEntityResponse("Актив");
  }
  const asset = await prisma.asset.create({
    data: {
      ...data,
      assetClass: resolveAssetClass(data.type, assetClass) ?? "PERSONAL",
      userId,
    },
  });
  void recordRevision({
    userId,
    entityType: "asset",
    entityId: asset.id,
    action: "CREATE",
    label: `Актив создан: ${asset.name}`,
    before: null,
    after: asset,
  }).catch(() => {});
  return NextResponse.json(asset, { status: 201 });
}
