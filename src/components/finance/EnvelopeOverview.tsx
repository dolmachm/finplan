"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DashboardTab } from "@/components/layout/DashboardShell";
import type { EnvelopeStatus } from "@/modules/budget/envelopes";
import { formatRub } from "@/shared/format";

function barPct(value: number, limit: number | null): number | null {
  if (limit == null || limit <= 0) return null;
  return Math.min(100, (value / limit) * 100);
}

export function EnvelopeBars({
  statuses,
  mode = "plan",
  emptyHint = "Задайте лимиты или разнесите расходы по категориям.",
}: {
  statuses: EnvelopeStatus[];
  /** plan = план/лимит; actual = факт/лимит */
  mode?: "plan" | "actual";
  emptyHint?: string;
}) {
  if (statuses.length === 0) {
    return <p className="text-sm text-muted">{emptyHint}</p>;
  }

  return (
    <ul className="space-y-3">
      {statuses.map((s) => {
        const value =
          mode === "actual" ? (s.actualMonthly ?? 0) : s.plannedMonthly;
        const pct = barPct(value, s.monthlyLimit);
        const over =
          mode === "actual"
            ? s.monthlyLimit != null && value > s.monthlyLimit + 0.01
            : s.overspent;
        const remaining =
          s.monthlyLimit == null ? null : s.monthlyLimit - value;
        return (
          <li key={s.categoryId}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-foreground">{s.name}</span>
              <span className="shrink-0 tabular-nums text-muted">
                {formatRub(value)}
                {s.monthlyLimit != null ? (
                  <>
                    <span className="text-muted/70"> / </span>
                    {formatRub(s.monthlyLimit)}
                  </>
                ) : null}
              </span>
            </div>
            {pct != null ? (
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border">
                <div
                  className={`h-full rounded-full transition-[width] ${
                    over
                      ? "bg-red-500"
                      : pct >= 85
                        ? "bg-amber-500"
                        : "bg-brand"
                  }`}
                  style={{ width: `${Math.max(pct, value > 0 ? 2 : 0)}%` }}
                />
              </div>
            ) : value > 0 ? (
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border">
                <div className="h-full w-full rounded-full bg-border" />
              </div>
            ) : (
              <div className="mt-1.5 h-2 rounded-full bg-border/60" />
            )}
            {remaining != null && (
              <p
                className={`mt-1 text-xs ${
                  over ? "text-red-600" : "text-muted"
                }`}
              >
                {over
                  ? `Перерасход ${formatRub(-remaining)}`
                  : `Свободно ${formatRub(remaining)}`}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function EnvelopeOverviewCard({
  statuses,
  plannedTotal,
  limitTotal,
  incomeMonthly,
  overspentCount,
  actualExpenseMonth,
  onNavigate,
}: {
  statuses: EnvelopeStatus[];
  plannedTotal: number;
  limitTotal: number;
  incomeMonthly: number;
  overspentCount: number;
  actualExpenseMonth?: number | null;
  onNavigate?: (tab: DashboardTab) => void;
}) {
  const hasAny =
    statuses.some(
      (s) =>
        s.plannedMonthly > 0.01 ||
        (s.actualMonthly ?? 0) > 0.01 ||
        s.monthlyLimit != null,
    );
  if (!hasAny) return null;

  const floor = Math.max(plannedTotal, limitTotal);
  const afterBudget = incomeMonthly - floor;
  const showActual =
    statuses.some((s) => s.actualMonthly != null) ||
    (actualExpenseMonth != null && actualExpenseMonth > 0);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Бюджет
          </p>
          <h2 className="mt-1 font-medium">Конверты категорий</h2>
        </div>
        {onNavigate && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => onNavigate("assets")}
          >
            Настроить
          </Button>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted">Расходы / мес</p>
          <p className="mt-0.5 text-base font-semibold tabular-nums">
            {formatRub(plannedTotal)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Лимиты / мес</p>
          <p className="mt-0.5 text-base font-semibold tabular-nums">
            {limitTotal > 0 ? formatRub(limitTotal) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">После бюджета</p>
          <p
            className={`mt-0.5 text-base font-semibold tabular-nums ${
              afterBudget < 0 ? "text-red-600" : ""
            }`}
          >
            {formatRub(afterBudget)}
          </p>
        </div>
      </div>

      {actualExpenseMonth != null && (
        <p className="mt-3 text-sm text-muted">
          Факт расходов в этом месяце:{" "}
          <span className="font-medium tabular-nums text-foreground">
            {formatRub(actualExpenseMonth)}
          </span>
        </p>
      )}

      {overspentCount > 0 && (
        <p className="mt-3 text-sm text-amber-700">
          Перерасход в {overspentCount}{" "}
          {overspentCount === 1 ? "категории" : "категориях"}
        </p>
      )}

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          {showActual ? "Факт / лимит" : "План / лимит"}
        </p>
        <EnvelopeBars
          mode={showActual ? "actual" : "plan"}
          statuses={statuses.filter(
            (s) =>
              s.plannedMonthly > 0.01 ||
              (s.actualMonthly ?? 0) > 0.01 ||
              s.monthlyLimit != null,
          )}
        />
      </div>
    </Card>
  );
}
