"use client";

import {
  Area,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function MonteCarloBandChart({
  paths,
}: {
  paths: Array<{ label: string; netWorth: number[] }>;
}) {
  const worst = paths.find((p) => p.label === "worst");
  const best = paths.find((p) => p.label === "best");
  const median = paths.find((p) => p.label === "median");
  const len = Math.max(
    worst?.netWorth.length ?? 0,
    best?.netWorth.length ?? 0,
    median?.netWorth.length ?? 0,
  );

  const data = Array.from({ length: len }, (_, i) => ({
    month: i,
    p5: worst?.netWorth[i],
    p95: best?.netWorth[i],
    median: median?.netWorth[i],
  })).filter((_, i) => i % 6 === 0);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <XAxis dataKey="month" fontSize={11} />
          <YAxis fontSize={11} />
          <Tooltip />
          <Legend />
          <Area
            dataKey="p95"
            stroke="none"
            fill="#dbeafe"
            fillOpacity={0.5}
            name="Верхняя граница"
          />
          <Area
            dataKey="p5"
            stroke="none"
            fill="#fff"
            fillOpacity={1}
            name="Нижняя граница"
          />
          <Line
            dataKey="median"
            stroke="#2563eb"
            dot={false}
            name="Типичный"
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-muted">
        Синяя область: диапазон худший / лучший путь (иллюстрация MVP)
      </p>
    </div>
  );
}
