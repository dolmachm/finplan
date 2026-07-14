import { NextResponse } from "next/server";
import Papa from "papaparse";
import { z } from "zod";
import { formatZodIssues } from "@/shared/api-validation";
import { prisma } from "@/shared/db";
import { requireUserId, isErrorResponse } from "@/shared/session";
import {
  isDuplicateAsset,
  isDuplicateExpense,
  isDuplicateIncome,
} from "@/shared/duplicate-check";
import type { Asset, Expense, Income } from "@/shared/types";

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
    return NextResponse.json(
      {
        error: "Файл не выбран",
        fix: "Выберите CSV-файл с колонками type, name, amount",
      },
      { status: 400 },
    );
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  let created = 0;
  const errors: Array<{ row: number; message: string; fix: string }> = [];

  const [assets, incomes, expenses] = await Promise.all([
    prisma.asset.findMany({ where: { userId } }),
    prisma.income.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
  ]) as [Asset[], Income[], Expense[]];

  for (let i = 0; i < parsed.data.length; i++) {
    const raw = parsed.data[i];
    const rowNum = i + 2;
    const row = rowSchema.safeParse({
      type: raw.type?.toLowerCase(),
      name: raw.name,
      amount: raw.amount,
      category: raw.category,
      assetType: raw.asset_type ?? raw.assetType,
    });
    if (!row.success) {
      const issue = formatZodIssues(row.error.issues)[0];
      errors.push({
        row: rowNum,
        message: issue?.message ?? "Некорректная строка",
        fix:
          issue?.fix ??
          "Проверьте type (asset|income|expense), name и amount",
      });
      continue;
    }

    if (!row.data.name.trim()) {
      errors.push({
        row: rowNum,
        message: "Пустое название",
        fix: "Заполните колонку name",
      });
      continue;
    }

    if (row.data.type === "asset") {
      const candidate = { name: row.data.name, type: "OTHER" as const };
      if (isDuplicateAsset(assets, candidate)) {
        errors.push({
          row: rowNum,
          message: "Дубликат актива",
          fix: "Запись с таким названием и типом уже есть",
        });
        continue;
      }
      const createdRow = await prisma.asset.create({
        data: {
          userId,
          name: row.data.name,
          type: "OTHER",
          currentValue: row.data.amount,
        },
      });
      assets.push(createdRow);
      created++;
    } else if (row.data.type === "income") {
      const candidate = {
        name: row.data.name,
        source: "OTHER" as const,
        amount: row.data.amount,
        frequency: "MONTHLY" as const,
      };
      if (isDuplicateIncome(incomes, candidate)) {
        errors.push({
          row: rowNum,
          message: "Дубликат дохода",
          fix: "Запись с такими полями уже есть",
        });
        continue;
      }
      const createdRow = await prisma.income.create({
        data: {
          userId,
          name: row.data.name,
          source: "OTHER",
          amount: row.data.amount,
        },
      });
      incomes.push(createdRow);
      created++;
    } else if (row.data.type === "expense") {
      const category = row.data.category ?? "general";
      const candidate = {
        name: row.data.name,
        category,
        amount: row.data.amount,
        frequency: "MONTHLY" as const,
      };
      if (isDuplicateExpense(expenses, candidate)) {
        errors.push({
          row: rowNum,
          message: "Дубликат расхода",
          fix: "Запись с такими полями уже есть",
        });
        continue;
      }
      const createdRow = await prisma.expense.create({
        data: {
          userId,
          name: row.data.name,
          category,
          amount: row.data.amount,
        },
      });
      expenses.push(createdRow);
      created++;
    }
  }

  return NextResponse.json({
    created,
    skipped: errors.length,
    total: parsed.data.length,
    errors,
  });
}
