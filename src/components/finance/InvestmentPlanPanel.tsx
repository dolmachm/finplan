"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
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
import { FormField, HelpHint } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/ToastProvider";
import { FEATURE_HINTS } from "@/content/help";
import { readApiError, parsePositiveNumber } from "@/shared/api-client";
import { formatMoneyInput } from "@/shared/format-input";
import { newClientId } from "@/modules/iplan/client-id";
import { runIPlanProjection } from "@/modules/iplan/iplan.engine";
import type {
  IPlanProjection,
  IPlanStream,
  IPlanStreamFrequency,
  IPlanVariant,
  InvestmentPlan,
} from "@/modules/iplan/types";
import type { Asset } from "@/shared/types";

const FREQ_OPTIONS: { value: IPlanStreamFrequency; label: string }[] = [
  { value: "MONTHLY", label: "в месяц" },
  { value: "QUARTERLY", label: "в квартал" },
  { value: "YEARLY", label: "в год" },
  { value: "PERIOD", label: "за период" },
];

function fmtRub(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n);
}

function flagsBar(flags: boolean[]) {
  return flags.map((f) => (f ? "█" : "░")).join(" ");
}

type ApiPayload = {
  plan: InvestmentPlan;
  assets: Asset[];
  capitalAssets: Asset[];
  initialCapital: number;
  suggestedReturnPct: number;
  projection: IPlanProjection;
  comparisons: IPlanProjection[];
};

export function InvestmentPlanPanel({
  onUnauthorized,
  onAssetsChanged,
}: {
  onUnauthorized: (res: Response) => boolean;
  onAssetsChanged?: () => void;
}) {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assetDraft, setAssetDraft] = useState({
    name: "",
    currentValue: "",
    expectedReturnPct: "7",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/iplan", { cache: "no-store" });
      if (onUnauthorized(res)) return;
      if (!res.ok) {
        toast.error((await readApiError(res)).message);
        return;
      }
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  const plan = data?.plan;
  const active = plan?.variants.find((v) => v.id === plan.activeVariantId);

  function updateActive(mutator: (v: IPlanVariant) => IPlanVariant) {
    if (!plan || !active) return;
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        plan: {
          ...prev.plan,
          variants: prev.plan.variants.map((v) =>
            v.id === active.id ? mutator(v) : v,
          ),
        },
      };
    });
  }

  async function save() {
    if (!plan) return;
    setSaving(true);
    try {
      const res = await fetch("/api/iplan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activeVariantId: plan.activeVariantId,
          variants: plan.variants,
        }),
      });
      if (onUnauthorized(res)) return;
      if (!res.ok) {
        toast.error((await readApiError(res)).message);
        return;
      }
      setData(await res.json());
      toast.success("Инвест-план сохранён");
    } finally {
      setSaving(false);
    }
  }

  async function addInvestmentAsset() {
    const parsed = parsePositiveNumber(assetDraft.currentValue, "Сумма");
    if (!assetDraft.name.trim() || !parsed.ok) {
      toast.error(!parsed.ok ? parsed.message : "Укажите название актива");
      return;
    }
    const ret = Number(assetDraft.expectedReturnPct.replace(",", ".")) || 0;
    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: assetDraft.name.trim(),
        type: "BROKERAGE",
        assetClass: "INVESTMENT",
        currentValue: parsed.value,
        currency: "RUB",
        expectedReturnPct: ret,
        volatilityPct: 15,
        liquidityDays: 3,
        maintenanceCostMonthly: 0,
        dividendIncomeMonthly: 0,
        taxEffectPct: 0,
      }),
    });
    if (onUnauthorized(res)) return;
    if (!res.ok) {
      toast.error((await readApiError(res)).message);
      return;
    }
    setAssetDraft({ name: "", currentValue: "", expectedReturnPct: "7" });
    toast.success("Актив добавлен");
    onAssetsChanged?.();
    await load();
  }

  async function patchAsset(id: string, patch: Partial<Asset>) {
    const res = await fetch(`/api/assets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (onUnauthorized(res)) return;
    if (!res.ok) {
      toast.error((await readApiError(res)).message);
      return;
    }
    onAssetsChanged?.();
    await load();
  }

  function addVariant() {
    if (!plan || plan.variants.length >= 6) return;
    const base = active ?? plan.variants[0]!;
    const copy: IPlanVariant = {
      ...structuredClone(base),
      id: newClientId(),
      name: `Вариант ${plan.variants.length + 1}`,
      contributions: base.contributions.map((s) => ({
        ...s,
        id: newClientId(),
      })),
      goals: base.goals.map((s) => ({ ...s, id: newClientId() })),
    };
    setData((prev) =>
      prev
        ? {
            ...prev,
            plan: {
              ...prev.plan,
              variants: [...prev.plan.variants, copy],
              activeVariantId: copy.id,
            },
          }
        : prev,
    );
  }

  function addStream(kind: "contributions" | "goals") {
    updateActive((v) => {
      if (v[kind].length >= 6) return v;
      const y = v.startYear;
      const stream: IPlanStream = {
        id: newClientId(),
        name: kind === "contributions" ? "Взнос" : "Цель",
        amount: 0,
        frequency: kind === "goals" ? "YEARLY" : "MONTHLY",
        startYear: y,
        endYear: kind === "goals" ? y + 5 : y + 15,
        enabled: true,
        linkedEntityId: null,
      };
      return { ...v, [kind]: [...v[kind], stream] };
    });
  }

  if (loading || !data || !plan || !active) {
    return <p className="text-muted">Загрузка инвест-плана…</p>;
  }

  const projection = runIPlanProjection(active, data.initialCapital);
  const comparisons = plan.variants.map((v) =>
    runIPlanProjection(v, data.initialCapital),
  );

  const compareChart = (() => {
    const maxLen = Math.max(...comparisons.map((c) => c.rows.length), 0);
    const rows = [];
    for (let i = 0; i < maxLen; i++) {
      const point: Record<string, number | string> = {
        year: comparisons[0]?.rows[i]?.year ?? i,
      };
      for (const c of comparisons) {
        if (c.rows[i]) point[c.variantName] = c.rows[i]!.endCapital;
      }
      rows.push(point);
    }
    return rows;
  })();

  return (
    <div className="space-y-8">
      <HelpHint>{FEATURE_HINTS.iplan}</HelpHint>

      <section className="flex flex-wrap items-center gap-2">
        {plan.variants.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() =>
              setData((prev) =>
                prev
                  ? { ...prev, plan: { ...prev.plan, activeVariantId: v.id } }
                  : prev,
              )
            }
            className={
              v.id === plan.activeVariantId
                ? "rounded-lg bg-sidebar px-3 py-2 text-sm text-white"
                : "rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted/40"
            }
          >
            {v.name}
          </button>
        ))}
        {plan.variants.length < 6 && (
          <Button type="button" variant="secondary" onClick={addVariant}>
            + Вариант
          </Button>
        )}
        <div className="ml-auto">
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-muted">Начальный капитал</p>
          <p className="mt-1 text-2xl font-semibold">{fmtRub(data.initialCapital)}</p>
          <p className="mt-1 text-xs text-muted">
            Сумма инвестиционных активов (вкладка «Данные» ↔ здесь)
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Капитал в конце</p>
          <p className="mt-1 text-2xl font-semibold">
            {fmtRub(projection.finalCapital)}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Доходность (подсказка по активам)</p>
          <p className="mt-1 text-2xl font-semibold">
            {data.suggestedReturnPct.toFixed(1)}%
          </p>
          <button
            type="button"
            className="mt-2 text-xs text-brand underline"
            onClick={() =>
              updateActive((v) => ({
                ...v,
                returnSchedule: [
                  {
                    fromYear: null,
                    ratePct: Math.round(data.suggestedReturnPct * 10) / 10 || 6,
                  },
                ],
              }))
            }
          >
            Подставить в вариант
          </button>
        </Card>
      </section>

      <Card className="space-y-4">
        <h2 className="font-medium">Параметры варианта</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Название">
            <Input
              value={active.name}
              onChange={(e) =>
                updateActive((v) => ({ ...v, name: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Стартовый год">
            <Input
              type="number"
              value={active.startYear}
              onChange={(e) =>
                updateActive((v) => ({
                  ...v,
                  startYear: Number(e.target.value) || v.startYear,
                }))
              }
            />
          </FormField>
          <FormField label="Горизонт, лет">
            <Input
              type="number"
              value={active.horizonYears}
              onChange={(e) =>
                updateActive((v) => ({
                  ...v,
                  horizonYears: Math.min(100, Math.max(1, Number(e.target.value) || 1)),
                }))
              }
            />
          </FormField>
          <FormField label="Доходность, % годовых">
            <Input
              value={String(active.returnSchedule[0]?.ratePct ?? 0)}
              onChange={(e) => {
                const ratePct = Number(e.target.value.replace(",", ".")) || 0;
                updateActive((v) => ({
                  ...v,
                  returnSchedule: [{ fromYear: null, ratePct }, ...v.returnSchedule.slice(1)],
                }));
              }}
            />
          </FormField>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active.includeInitialCapital}
            onChange={(e) =>
              updateActive((v) => ({
                ...v,
                includeInitialCapital: e.target.checked,
              }))
            }
          />
          Учитывать начальный капитал из активов
        </label>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium">Инвестиционные активы</h2>
          <HelpHint>Те же сущности, что на вкладке «Данные»</HelpHint>
        </div>
        <ul className="divide-y divide-border text-sm">
          {data.capitalAssets.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-[8rem] font-medium">{a.name}</span>
              <Input
                className="w-36"
                defaultValue={formatMoneyInput(String(a.currentValue))}
                onBlur={(e) => {
                  const n = parsePositiveNumber(e.target.value, "Сумма");
                  if (n.ok && n.value !== a.currentValue) {
                    void patchAsset(a.id, { currentValue: n.value });
                  }
                }}
              />
              <Input
                className="w-24"
                defaultValue={String(a.expectedReturnPct)}
                onBlur={(e) => {
                  const n = Number(e.target.value.replace(",", "."));
                  if (!Number.isNaN(n) && n !== a.expectedReturnPct) {
                    void patchAsset(a.id, { expectedReturnPct: n });
                  }
                }}
              />
              <span className="text-muted">% год.</span>
            </li>
          ))}
          {data.capitalAssets.length === 0 && (
            <li className="py-2 text-muted">Нет активов — добавьте ниже или во вкладке «Данные»</li>
          )}
        </ul>
        <div className="grid gap-3 sm:grid-cols-4">
          <Input
            placeholder="Название"
            value={assetDraft.name}
            onChange={(e) => setAssetDraft((d) => ({ ...d, name: e.target.value }))}
          />
          <Input
            placeholder="Сумма"
            value={assetDraft.currentValue}
            onChange={(e) =>
              setAssetDraft((d) => ({ ...d, currentValue: e.target.value }))
            }
          />
          <Input
            placeholder="Доходность %"
            value={assetDraft.expectedReturnPct}
            onChange={(e) =>
              setAssetDraft((d) => ({ ...d, expectedReturnPct: e.target.value }))
            }
          />
          <Button type="button" onClick={addInvestmentAsset}>
            Добавить актив
          </Button>
        </div>
      </Card>

      <StreamsEditor
        title="Инвестиции (взносы)"
        streams={active.contributions}
        onChange={(contributions) => updateActive((v) => ({ ...v, contributions }))}
        onAdd={() => addStream("contributions")}
      />

      <StreamsEditor
        title="Инвестиционные цели"
        streams={active.goals}
        onChange={(goals) => updateActive((v) => ({ ...v, goals }))}
        onAdd={() => addStream("goals")}
      />

      <Card>
        <h2 className="font-medium">Капитал по годам — {active.name}</h2>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={projection.rows}>
              <defs>
                <linearGradient id="ip" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="year" fontSize={11} />
              <YAxis
                tickFormatter={(v) =>
                  v >= 1_000_000
                    ? `${(v / 1_000_000).toFixed(1)}M`
                    : `${(v / 1000).toFixed(0)}k`
                }
                fontSize={11}
              />
              <Tooltip
                formatter={(value) => fmtRub(Number(value ?? 0))}
                labelFormatter={(y) => `Год ${y}`}
              />
              <Area
                type="monotone"
                dataKey="endCapital"
                stroke="#2563eb"
                fill="url(#ip)"
                name="Капитал на конец года"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {plan.variants.length > 1 && (
        <Card>
          <h2 className="font-medium">Сравнение вариантов</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={compareChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="year" fontSize={11} />
                <YAxis
                  tickFormatter={(v) =>
                    v >= 1_000_000
                      ? `${(v / 1_000_000).toFixed(1)}M`
                      : `${(v / 1000).toFixed(0)}k`
                  }
                  fontSize={11}
                />
                <Tooltip formatter={(value) => fmtRub(Number(value ?? 0))} />
                <Legend />
                {comparisons.map((c, i) => (
                  <Line
                    key={c.variantId}
                    type="monotone"
                    dataKey={c.variantName}
                    stroke={["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2"][i % 6]}
                    dot={false}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card className="overflow-x-auto">
        <h2 className="font-medium">Таблица проекции</h2>
        <table className="mt-4 w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-2 pr-2">№</th>
              <th className="py-2 pr-2">Год</th>
              <th className="py-2 pr-2">%</th>
              <th className="py-2 pr-2">Начало</th>
              <th className="py-2 pr-2">Рост</th>
              <th className="py-2 pr-2">Взносы</th>
              <th className="py-2 pr-2">Цели</th>
              <th className="py-2 pr-2">Конец</th>
              <th className="py-2 pr-2">Взн.</th>
              <th className="py-2">Цели</th>
            </tr>
          </thead>
          <tbody>
            {projection.rows.map((r) => (
              <tr key={r.year} className="border-b border-border/60">
                <td className="py-1.5 pr-2">{r.index}</td>
                <td className="py-1.5 pr-2">{r.year}</td>
                <td className="py-1.5 pr-2">{r.ratePct}</td>
                <td className="py-1.5 pr-2">{fmtRub(r.startCapital)}</td>
                <td className="py-1.5 pr-2">{fmtRub(r.growth)}</td>
                <td className="py-1.5 pr-2">{fmtRub(r.contributionsTotal)}</td>
                <td className="py-1.5 pr-2">{fmtRub(r.goalsTotal)}</td>
                <td className="py-1.5 pr-2 font-medium">{fmtRub(r.endCapital)}</td>
                <td className="py-1.5 pr-2 font-mono text-xs">
                  {flagsBar(r.contributionFlags)}
                </td>
                <td className="py-1.5 font-mono text-xs">{flagsBar(r.goalFlags)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">
          Доходность не гарантирована; прошлые результаты не определяют будущие доходы.
        </p>
      </Card>
    </div>
  );
}

function StreamsEditor({
  title,
  streams,
  onChange,
  onAdd,
}: {
  title: string;
  streams: IPlanStream[];
  onChange: (next: IPlanStream[]) => void;
  onAdd: () => void;
}) {
  function patch(id: string, patch: Partial<IPlanStream>) {
    onChange(streams.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{title}</h2>
        {streams.length < 6 && (
          <Button type="button" variant="secondary" onClick={onAdd}>
            + Строка
          </Button>
        )}
      </div>
      {streams.length === 0 && (
        <p className="text-sm text-muted">Пусто — добавьте строку</p>
      )}
      {streams.map((s, idx) => (
        <div
          key={s.id}
          className="grid gap-2 rounded-lg border border-border/70 p-3 sm:grid-cols-6"
        >
          <label className="flex items-center gap-2 text-sm sm:col-span-6">
            <input
              type="checkbox"
              checked={s.enabled}
              onChange={(e) => patch(s.id, { enabled: e.target.checked })}
            />
            {idx + 1}. активна
          </label>
          <Input
            className="sm:col-span-2"
            placeholder="Название"
            value={s.name}
            onChange={(e) => patch(s.id, { name: e.target.value })}
          />
          <Input
            placeholder="Сумма"
            value={s.amount ? formatMoneyInput(String(s.amount)) : ""}
            onChange={(e) => {
              const n = parsePositiveNumber(e.target.value, "Сумма");
              patch(s.id, { amount: n.ok ? n.value : 0 });
            }}
          />
          <select
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
            value={s.frequency}
            onChange={(e) =>
              patch(s.id, { frequency: e.target.value as IPlanStreamFrequency })
            }
          >
            {FREQ_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Input
            type="number"
            placeholder="С года"
            value={s.startYear}
            onChange={(e) =>
              patch(s.id, { startYear: Number(e.target.value) || s.startYear })
            }
          />
          <Input
            type="number"
            placeholder="По год"
            value={s.endYear}
            onChange={(e) =>
              patch(s.id, { endYear: Number(e.target.value) || s.endYear })
            }
          />
          <button
            type="button"
            className="text-left text-xs text-muted underline sm:col-span-6"
            onClick={() => onChange(streams.filter((x) => x.id !== s.id))}
          >
            Удалить
          </button>
        </div>
      ))}
    </Card>
  );
}
