import { NextResponse } from "next/server";
import type { Asset, Expense, Goal, Income } from "@/shared/types";

export function normName(name: string): string {
  return name.trim().toLowerCase();
}

export function duplicateEntityResponse(label: string): NextResponse {
  return NextResponse.json(
    {
      error: `${label} уже существует`,
      issues: [
        {
          field: "name",
          message: "Такая запись уже добавлена",
          fix: "Измените данные или отредактируйте существующую запись",
        },
      ],
    },
    { status: 409 },
  );
}

export function isDuplicateAsset(
  rows: Asset[],
  candidate: { name: string; type: string },
  excludeId?: string,
): boolean {
  const name = normName(candidate.name);
  return rows.some(
    (r) => r.id !== excludeId && normName(r.name) === name && r.type === candidate.type,
  );
}

export function isDuplicateIncome(
  rows: Income[],
  candidate: {
    name: string;
    source: string;
    amount: number;
    frequency: string;
  },
  excludeId?: string,
): boolean {
  const name = normName(candidate.name);
  return rows.some(
    (r) =>
      r.id !== excludeId &&
      normName(r.name) === name &&
      r.source === candidate.source &&
      r.amount === candidate.amount &&
      r.frequency === candidate.frequency,
  );
}

export function isDuplicateExpense(
  rows: Expense[],
  candidate: {
    name: string;
    category: string;
    amount: number;
    frequency: string;
  },
  excludeId?: string,
): boolean {
  const name = normName(candidate.name);
  return rows.some(
    (r) =>
      r.id !== excludeId &&
      normName(r.name) === name &&
      normName(r.category) === normName(candidate.category) &&
      r.amount === candidate.amount &&
      r.frequency === candidate.frequency,
  );
}

function sameGoalDate(a: Date | string, b: Date | string): boolean {
  return new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);
}

export function isDuplicateGoal(
  rows: Goal[],
  candidate: {
    name: string;
    goalType: string;
    targetAmountNominal: number;
    targetDate: Date | string;
  },
  excludeId?: string,
): boolean {
  const name = normName(candidate.name);
  return rows.some(
    (r) =>
      r.id !== excludeId &&
      normName(r.name) === name &&
      (r.goalType ?? "OTHER") === candidate.goalType &&
      r.targetAmountNominal === candidate.targetAmountNominal &&
      sameGoalDate(r.targetDate, candidate.targetDate),
  );
}
