"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HelpHint } from "@/components/ui/FormField";
import { toast } from "@/components/ui/ToastProvider";

type ScenarioRow = { id: string; name: string; isActive: boolean };

type Comparison = {
  scenarioId: string | null;
  name: string;
  isActive: boolean;
  summary: {
    finalNetWorth: number;
    avgMonthlySurplus: number;
    recommendedMonthlySaving: number;
  };
  monthly: Array<{ month: number; netWorth: number }>;
};

const COLORS = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#64748b"];

function fmtRub(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n);
}

export function ScenarioCompare({
  scenarios,
  onUnauthorized,
  compact = false,
}: {
  scenarios: ScenarioRow[];
  onUnauthorized: (res: Response) => boolean;
  compact?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selected.length === 0 && scenarios.length) {
      setSelected(scenarios.slice(0, 3).map((s) => s.id));
    }
  }, [scenarios, selected.length]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs =
        selected.length > 0 ? `?ids=${selected.map(encodeURIComponent).join(",")}` : "";
      const res = await fetch(`/api/plan/compare${qs}`, { cache: "no-store" });
      if (onUnauthorized(res)) return;
      if (!res.ok) {
        toast.error("Не удалось сравнить сценарии");
        return;
      }
      const data = await res.json();
      setComparisons(data.comparisons ?? []);
    } finally {
      setLoading(false);
    }
  }, [selected, onUnauthorized]);

  useEffect(() => {
    void load();
  }, [load]);

  const chartData = useMemo(() => {
    const maxLen = Math.max(...comparisons.map((c) => c.monthly.length), 0);
    const rows: Array<Record<string, number | string>> = [];
    for (let i = 0; i < maxLen; i++) {
      const point: Record<string, number | string> = {
        month: comparisons[0]?.monthly[i]?.month ?? i * 12,
      };
      for (const c of comparisons) {
        const nw = c.monthly[i]?.netWorth;
        if (nw != null) point[c.name] = nw;
      }
      rows.push(point);
    }
    return rows;
  }, [comparisons]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= 5
          ? prev
          : [...prev, id],
    );
  }

  return (
    <Card className={compact ? "space-y-3 !p-3" : "space-y-4"}>
      <div>
        <h2 className={compact ? "text-sm font-medium" : "font-medium"}>Сравнение сценариев</h2>
        {!compact && (
          <HelpHint>
            Выберите до 5 сохранённых сценариев — базовый план всегда в сравнении.
            Проверьте: «что, если» изменится ситуация.
          </HelpHint>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {scenarios.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => toggle(s.id)}
            className={
              selected.includes(s.id)
                ? "rounded-lg bg-sidebar px-3 py-1.5 text-xs text-white"
                : "rounded-lg border border-border px-3 py-1.5 text-xs"
            }
          >
            {s.name}
          </button>
        ))}
        <Button type="button" variant="secondary" onClick={load} disabled={loading}>
          {loading ? "…" : "Обновить"}
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-2 pr-2">Сценарий</th>
              <th className="py-2 pr-2">Чистые активы (конец)</th>
              <th className="py-2 pr-2">Ср. профицит / мес</th>
              <th className="py-2">Рек. взнос / мес</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c) => (
              <tr key={c.scenarioId ?? "base"} className="border-b border-border/50">
                <td className="py-1.5 pr-2 font-medium">
                  {c.name}
                  {c.isActive ? " · активный" : ""}
                </td>
                <td className="py-1.5 pr-2">{fmtRub(c.summary.finalNetWorth)}</td>
                <td className="py-1.5 pr-2">{fmtRub(c.summary.avgMonthlySurplus)}</td>
                <td className="py-1.5">{fmtRub(c.summary.recommendedMonthlySaving)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {chartData.length > 0 && (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis
                dataKey="month"
                tickFormatter={(m) => `${Math.floor(Number(m) / 12)}г`}
                fontSize={11}
              />
              <YAxis
                tickFormatter={(v) =>
                  v >= 1_000_000
                    ? `${(v / 1_000_000).toFixed(1)}M`
                    : `${(v / 1000).toFixed(0)}k`
                }
                fontSize={11}
              />
              <Tooltip formatter={(v) => fmtRub(Number(v ?? 0))} />
              <Legend />
              {comparisons.map((c, i) => (
                <Line
                  key={c.scenarioId ?? "base"}
                  type="monotone"
                  dataKey={c.name}
                  stroke={COLORS[i % COLORS.length]}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
