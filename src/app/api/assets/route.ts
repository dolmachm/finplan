import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/shared/api-validation";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";

const assetSchema = z.object({
  name: z.string().min(1),
  type: z.enum([
    "CASH",
    "BANK_ACCOUNT",
    "DEPOSIT",
    "BROKERAGE",
    "IIS",
    "MUTUAL_FUND",
    "CRYPTO",
    "REAL_ESTATE",
    "VEHICLE",
    "COLLECTIBLE",
    "OTHER",
  ]),
  currentValue: z.number().nonnegative(),
  currency: z.string().default("RUB"),
  expectedReturnPct: z.number().default(0),
  volatilityPct: z.number().default(0),
  liquidityDays: z.number().int().default(0),
  maintenanceCostMonthly: z.number().default(0),
  dividendIncomeMonthly: z.number().default(0),
  taxEffectPct: z.number().default(0),
});

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
  const data = parsed.data;
  const asset = await prisma.asset.create({ data: { ...data, userId } });
  return NextResponse.json(asset, { status: 201 });
}
