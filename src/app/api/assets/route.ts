import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/shared/api-validation";
import { ASSET_TYPE_OPTIONS } from "@/shared/finance-catalog";
import { assetSchema } from "@/shared/finance-schemas";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";

function resolveAssetClass(
  type: z.infer<typeof assetSchema>["type"],
  assetClass?: "PERSONAL" | "INVESTMENT",
) {
  return (
    assetClass ??
    ASSET_TYPE_OPTIONS.find((o) => o.value === type)?.class ??
    "PERSONAL"
  );
}

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
  const asset = await prisma.asset.create({
    data: {
      ...data,
      assetClass: resolveAssetClass(data.type, assetClass),
      userId,
    },
  });
  return NextResponse.json(asset, { status: 201 });
}
