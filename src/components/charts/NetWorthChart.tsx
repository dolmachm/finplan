"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function NetWorthChart({
  data,
}: {
  data: Array<{ month: number; netWorth: number; cashflow?: number }>;
}) {
  const sampled = data.filter((_, i) => i % 3 === 0 || i === data.length - 1);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={sampled}>
          <defs>
            <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis
            dataKey="month"
            tickFormatter={(m) => `${Math.floor(m / 12)}г`}
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
          <Tooltip
            formatter={(value) =>
              new Intl.NumberFormat("ru-RU").format(Number(value ?? 0)) + " ₽"
            }
            labelFormatter={(m) => `Месяц ${m}`}
          />
          <Area
            type="monotone"
            dataKey="netWorth"
            stroke="#2563eb"
            fill="url(#nw)"
            name="Чистые активы"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
