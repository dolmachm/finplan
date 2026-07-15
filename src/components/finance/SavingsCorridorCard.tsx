"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DashboardTab } from "@/components/layout/DashboardShell";
import type {
  SavingsCorridor,
  SavingsRecommendation,
} from "@/modules/budget/savings-corridor";
import { formatRub } from "@/shared/format";

const actionLabel: Record<SavingsRecommendation["action"], string> = {
  cut: "Сократить",
  raise: "Увеличить доход",
  tighten: "Лимит",
  deploy: "Направить",
};

function CorridorGauge({
  low,
  base,
  stretch,
  income,
}: {
  low: number;
  base: number;
  stretch: number;
  income: number;
}) {
  const max = Math.max(income * 0.35, stretch, base, low, 1);
  const clamp = (v: number) =>
    Math.max(0, Math.min(100, ((Math.max(0, v)) / max) * 100));

  const lowPct = clamp(low);
  const basePct = clamp(base);
  const stretchPct = clamp(stretch);
  const bandLeft = Math.min(lowPct, basePct, stretchPct);
  const bandWidth = Math.max(lowPct, basePct, stretchPct) - bandLeft;

  return (
    <div className="space-y-2">
      <div className="relative h-3 rounded-full bg-border">
        <div
          className="absolute inset-y-0 rounded-full bg-brand/25"
          style={{ left: `${bandLeft}%`, width: `${Math.max(bandWidth, 2)}%` }}
        />
        <div
          className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-full bg-muted-foreground/40"
          style={{ left: `calc(${lowPct}% - 2px)` }}
          title="После конвертов"
        />
        <div
          className="absolute top-1/2 h-4 w-1.5 -translate-y-1/2 rounded-full bg-brand"
          style={{ left: `calc(${basePct}% - 3px)` }}
          title="Сейчас"
        />
        <div
          className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-full bg-emerald-600"
          style={{ left: `calc(${stretchPct}% - 2px)` }}
          title="Потенциал"
        />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>
          Мин. <strong className="text-foreground">{formatRub(low)}</strong>
        </span>
        <span>
          Сейчас <strong className="text-foreground">{formatRub(base)}</strong>
        </span>
        <span>
          Потенциал{" "}
          <strong className="text-foreground">{formatRub(stretch)}</strong>
        </span>
      </div>
    </div>
  );
}

function TrajectoryChart({
  trajectory,
}: {
  trajectory: SavingsCorridor["trajectory"];
}) {
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={trajectory}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="month"
            tickFormatter={(m) => `${m}м`}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tickFormatter={(v) =>
              v >= 1_000_000
                ? `${(v / 1_000_000).toFixed(1)}м`
                : v >= 1000
                  ? `${Math.round(v / 1000)}к`
                  : String(v)
            }
            width={40}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(value) => formatRub(Number(value ?? 0))}
            labelFormatter={(m) => `Через ${m} мес.`}
          />
          <Line
            type="monotone"
            dataKey="stretch"
            name="Потенциал"
            stroke="#059669"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="base"
            name="Текущий темп"
            stroke="var(--color-brand, #0d9488)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="low"
            name="После конвертов"
            stroke="#94a3b8"
            strokeWidth={1.5}
            strokeDasharray="2 3"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SavingsCorridorCard({
  data,
  onNavigate,
}: {
  data: SavingsCorridor;
  onNavigate: (tab: DashboardTab) => void;
}) {
  const ratePct = (data.savingsRate * 100).toFixed(0);
  const deltaPositive = data.deltaMonthly >= 0;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Сбережения
          </p>
          <h2 className="mt-1 font-medium">Сколько можно откладывать</h2>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onNavigate("assets")}
        >
          К доходам и расходам
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs text-muted">Доход − расход</p>
          <p
            className={`mt-1 text-lg font-semibold tabular-nums ${
              deltaPositive ? "" : "text-red-600"
            }`}
          >
            {formatRub(data.deltaMonthly)}
          </p>
          <p className="mt-0.5 text-xs text-muted">Δ / мес</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs text-muted">Норма сбережений</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{ratePct}%</p>
          <p className="mt-0.5 text-xs text-muted">
            цель 10–20% ·{" "}
            {data.targets.gapTo10 > 0
              ? `до 10%: ${formatRub(data.targets.gapTo10)}`
              : data.targets.gapTo20 > 0
                ? `до 20%: ${formatRub(data.targets.gapTo20)}`
                : "в коридоре"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs text-muted">После конвертов</p>
          <p
            className={`mt-1 text-lg font-semibold tabular-nums ${
              data.afterEnvelopesMonthly < 0 ? "text-red-600" : ""
            }`}
          >
            {formatRub(data.afterEnvelopesMonthly)}
          </p>
          <p className="mt-0.5 text-xs text-muted">мин. из коридора</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs text-muted">Потенциал</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-700">
            {formatRub(data.corridor.stretch)}
          </p>
          <p className="mt-0.5 text-xs text-muted">если поджать расходы</p>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <p className="text-sm font-medium">Коридор отложений / мес</p>
        <CorridorGauge
          low={data.corridor.low}
          base={data.corridor.base}
          stretch={data.corridor.stretch}
          income={data.incomeMonthly}
        />
      </div>

      <div className="mt-6">
        <p className="text-sm font-medium">Динамика накопления · 12 мес.</p>
        <p className="mt-0.5 text-xs text-muted">
          Накопленная сумма при текущем темпе, после конвертов и при потенциале
        </p>
        <div className="mt-3">
          <TrajectoryChart trajectory={data.trajectory} />
        </div>
      </div>

      {data.recommendations.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-medium">Что изменить</p>
          <ul className="mt-3 space-y-2">
            {data.recommendations.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-border bg-background p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">{r.title}</p>
                  <span className="text-xs text-muted">
                    {actionLabel[r.action]}
                    {r.impactMonthly > 0
                      ? ` · +${formatRub(r.impactMonthly)}/мес`
                      : ""}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">{r.body}</p>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onNavigate("assets")}
            >
              Править бюджет
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onNavigate("plan")}
            >
              В план
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
