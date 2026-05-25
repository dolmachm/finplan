import { NextResponse } from "next/server";
import Papa from "papaparse";
import { z } from "zod";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";

const rowSchema = z.object({
  type: z.enum(["asset", "income", "expense"]),
  name: z.string(),
  amount: z.coerce.number(),
  category: z.string().optional(),
  assetType: z.string().optional(),
});

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  let created = 0;
  for (const raw of parsed.data) {
    const row = rowSchema.safeParse({
      type: raw.type?.toLowerCase(),
      name: raw.name,
      amount: raw.amount,
      category: raw.category,
      assetType: raw.asset_type ?? raw.assetType,
    });
    if (!row.success) continue;

    if (row.data.type === "asset") {
      await prisma.asset.create({
        data: {
          userId,
          name: row.data.name,
          type: "OTHER",
          currentValue: row.data.amount,
        },
      });
      created++;
    } else if (row.data.type === "income") {
      await prisma.income.create({
        data: {
          userId,
          name: row.data.name,
          source: "OTHER",
          amount: row.data.amount,
        },
      });
      created++;
    } else if (row.data.type === "expense") {
      await prisma.expense.create({
        data: {
          userId,
          name: row.data.name,
          category: row.data.category ?? "general",
          amount: row.data.amount,
        },
      });
      created++;
    }
  }

  return NextResponse.json({ created, total: parsed.data.length });
}
