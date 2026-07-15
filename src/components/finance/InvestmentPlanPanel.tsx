"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { formControlClass } from "@/components/ui/form-controls";
import { toast } from "@/components/ui/ToastProvider";
import { FEATURE_HINTS, FIELD_HINTS } from "@/content/help";
import { readApiError, parsePositiveNumber } from "@/shared/api-client";
import { formatMoneyInput } from "@/shared/format-input";
import { formatRub } from "@/shared/format";
import { newClientId } from "@/modules/iplan/client-id";
import {
  normalizeVariant,
  runIPlanMonteCarlo,
  runIPlanProjection,
} from "@/modules/iplan/iplan.engine";
import {
  toBudgetLines,
  validateContributionsVsBudget,
} from "@/modules/iplan/budget";
import { envelopeReserveBudgetLine } from "@/modules/budget/envelopes";
import type {
  IPlanDistribution,
  IPlanMcResult,
  IPlanStream,
  IPlanStreamFrequency,
  IPlanVariant,
  InvestmentPlan,
} from "@/modules/iplan/types";
import type { Asset, BudgetCategory, Expense, Income } from "@/shared/types";
import { ChangeHistoryPanel } from "@/components/finance/ChangeHistoryPanel";

const FREQ_OPTIONS: { value: IPlanStreamFrequency; label: string }[] = [
  { value: "MONTHLY", label: "в месяц" },
  { value: "QUARTERLY", label: "в квартал" },
  { value: "YEARLY", label: "в год" },
  { value: "PERIOD", label: "за период" },
];

const DIST_OPTIONS: { value: IPlanDistribution; label: string }[] = [
  { value: "RISK_FREE", label: "Безрисковое" },
  { value: "NORMAL", label: "Нормальное" },
  { value: "LOGNORMAL", label: "Лог. нормальное" },
];

function flagsBar(flags: boolean[]) {
  return flags.map((f) => (f ? "█" : "░")).join(" ");
}

type ApiPayload = {
  plan: InvestmentPlan;
  assets: Asset[];
  capitalAssets: Asset[];
  initialCapital: number;
  suggestedReturnPct: number;
  suggestedVolatilityPct: number;
  incomes: Income[];
  expenses: Expense[];
  budgetCategories?: BudgetCategory[];
  surplusMonthly: number;
  surplusAnnual: number;
};

export function InvestmentPlanPanel({
  onUnauthorized,
  onAssetsChanged,
  compact = false,
  hideMcChart = false,
  hideHistory = false,
}: {
  onUnauthorized: (res: Response) => boolean;
  onAssetsChanged?: () => void;
  compact?: boolean;
  hideMcChart?: boolean;
  hideHistory?: boolean;
}) {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mcBusy, setMcBusy] = useState(false);
  const [mc, setMc] = useState<IPlanMcResult | null>(null);
  const [assetDraft, setAssetDraft] = useState({
    name: "",
    currentValue: "",
    expectedReturnPct: "7",
    volatilityPct: "15",
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
      const json = await res.json();
      setData({
        plan: json.plan,
        assets: json.assets,
        capitalAssets: json.capitalAssets,
        initialCapital: json.initialCapital,
        suggestedReturnPct: json.suggestedReturnPct,
        suggestedVolatilityPct: json.suggestedVolatilityPct ?? 15,
        incomes: json.incomes ?? [],
        expenses: json.expenses ?? [],
        surplusMonthly: json.surplusMonthly ?? 0,
        surplusAnnual: json.surplusAnnual ?? 0,
      });
      setMc(json.monteCarlo ?? null);
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  const plan = data?.plan;
  const activeRaw = plan?.variants.find((v) => v.id === plan.activeVariantId);
  const active = activeRaw ? normalizeVariant(activeRaw) : null;

  const budgetIncomes = useMemo(
    () => (data ? toBudgetLines(data.incomes) : []),
    [data],
  );
  const budgetExpenses = useMemo(() => {
    if (!data) return [];
    const reserve = envelopeReserveBudgetLine(
      data.expenses,
      data.budgetCategories ?? [],
    );
    return toBudgetLines(reserve ? [...data.expenses, reserve] : data.expenses);
  }, [data]);

  const projection = useMemo(() => {
    if (!active || !data) return null;
    return runIPlanProjection(
      active,
      data.initialCapital,
      budgetIncomes,
      budgetExpenses,
    );
  }, [active, data, budgetIncomes, budgetExpenses]);

  const budgetError = useMemo(() => {
    if (!active || !data) return null;
    const check = validateContributionsVsBudget({
      contributions: active.contributions,
      incomes: budgetIncomes,
      expenses: budgetExpenses,
      startYear: active.startYear,
      horizonYears: active.horizonYears,
    });
    return check.ok ? null : check.message;
  }, [active, data, budgetIncomes, budgetExpenses]);

  const liveMc = useMemo(() => {
    if (!active || !data) return null;
    if (active.distribution === "RISK_FREE") {
      return runIPlanMonteCarlo(
        { ...active, mcRuns: 50 },
        data.initialCapital,
        budgetIncomes,
        budgetExpenses,
      );
    }
    return mc;
  }, [active, data, mc, budgetIncomes, budgetExpenses]);

  function updateActive(mutator: (v: IPlanVariant) => IPlanVariant) {
    if (!plan || !active) return;
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        plan: {
          ...prev.plan,
          variants: prev.plan.variants.map((v) =>
            v.id === active.id ? normalizeVariant(mutator(v)) : v,
          ),
        },
      };
    });
  }

  async function save() {
    if (!plan || !active) return;
    if (budgetError) {
      toast.error(budgetError);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/iplan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activeVariantId: plan.activeVariantId,
          variants: plan.variants.map(normalizeVariant),
        }),
      });
      if (onUnauthorized(res)) return;
      if (!res.ok) {
        toast.error((await readApiError(res)).message);
        return;
      }
      const json = await res.json();
      setData({
        plan: json.plan,
        assets: json.assets,
        capitalAssets: json.capitalAssets,
        initialCapital: json.initialCapital,
        suggestedReturnPct: json.suggestedReturnPct,
        suggestedVolatilityPct: json.suggestedVolatilityPct ?? 15,
        incomes: json.incomes ?? [],
        expenses: json.expenses ?? [],
        surplusMonthly: json.surplusMonthly ?? 0,
        surplusAnnual: json.surplusAnnual ?? 0,
      });
      setMc(json.monteCarlo ?? null);
      toast.success("Инвест-план сохранён");
    } finally {
      setSaving(false);
    }
  }

  function rerunMc() {
    if (!active || !data) return;
    if (budgetError) {
      toast.error(budgetError);
      return;
    }
    setMcBusy(true);
    try {
      const result = runIPlanMonteCarlo(
        active,
        data.initialCapital,
        budgetIncomes,
        budgetExpenses,
      );
      setMc(result);
      toast.success(`Прогноз риска: ${active.mcRuns} вариантов`);
    } finally {
      setMcBusy(false);
    }
  }

  async function addInvestmentAsset() {
    const parsed = parsePositiveNumber(assetDraft.currentValue, "Сумма");
    if (!assetDraft.name.trim() || !parsed.ok) {
      toast.error(!parsed.ok ? parsed.message : "Укажите название актива");
      return;
    }
    const ret = Number(assetDraft.expectedReturnPct.replace(",", ".")) || 0;
    const vol = Number(assetDraft.volatilityPct.replace(",", ".")) || 15;
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
        volatilityPct: vol,
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
    setAssetDraft({
      name: "",
      currentValue: "",
      expectedReturnPct: "7",
      volatilityPct: "15",
    });
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
    if (!plan || plan.variants.length >= 6 || !active) return;
    const copy: IPlanVariant = {
      ...structuredClone(active),
      id: newClientId(),
      name: `Вариант ${plan.variants.length + 1}`,
      contributions: active.contributions.map((s) => ({
        ...s,
        id: newClientId(),
      })),
      goals: active.goals.map((s) => ({ ...s, id: newClientId() })),
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
      if (v[kind].length >= 9) return v;
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

  function addReturnStep() {
    updateActive((v) => {
      if (v.returnSchedule.length >= 6) return v;
      return {
        ...v,
        returnSchedule: [
          ...v.returnSchedule,
          {
            fromYear: v.startYear + 5,
            ratePct: 4,
            volatilityPct: 10,
          },
        ],
      };
    });
  }

  if (loading || !data || !plan || !active || !projection) {
    return <p className="text-muted">Загрузка инвест-плана…</p>;
  }

  const comparisons = plan.variants.map((v) =>
    runIPlanProjection(
      normalizeVariant(v),
      data.initialCapital,
      budgetIncomes,
      budgetExpenses,
    ),
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

  const axisKey =
    active.axisMode === "AGE"
      ? "age"
      : active.axisMode === "INDEX"
        ? "index"
        : "year";

  const fieldCls = compact
    ? `${formControlClass} !px-2 !py-1.5 !text-xs`
    : formControlClass;

  return (
    <div className={compact ? "space-y-3" : "space-y-8"}>
      {!compact && <HelpHint>{FEATURE_HINTS.iplan}</HelpHint>}

      {budgetError && (
        <div className="rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-danger">
          {budgetError}
        </div>
      )}

      {compact ? (
        <Card className="!p-3">
          <p className="text-xs text-muted">
            Профицит (лимит взносов):{" "}
            <span className="font-semibold text-brand">
              {formatRub(data.surplusMonthly)}/мес
            </span>
            {" · "}
            {formatRub(data.surplusAnnual)}/год
          </p>
        </Card>
      ) : (
      <Card className="space-y-3">
        <h2 className="font-medium">Бюджет из вкладки «Данные»</h2>
        <HelpHint>
          Доходы и расходы сквозные — правятся только в «Данных». Ежемесячный взнос по
          умолчанию = профицит (доходы − расходы).
        </HelpHint>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted">Доходы / мес. экв.</p>
            <p className="text-lg font-semibold">
              {formatRub(
                data.incomes.reduce((s, i) => {
                  const m =
                    i.frequency === "YEARLY"
                      ? i.amount / 12
                      : i.frequency === "QUARTERLY"
                        ? i.amount / 3
                        : i.frequency === "SEMI_ANNUAL"
                          ? i.amount / 6
                          : i.amount;
                  return s + m;
                }, 0),
              )}
            </p>
            <ul className="mt-1 max-h-24 overflow-y-auto text-xs text-muted">
              {data.incomes.map((i) => (
                <li key={i.id}>
                  {i.name}: {formatRub(i.amount)} ({i.frequency})
                </li>
              ))}
              {data.incomes.length === 0 && <li>Нет доходов</li>}
            </ul>
          </div>
          <div>
            <p className="text-xs text-muted">Расходы / мес. экв.</p>
            <p className="text-lg font-semibold">
              {formatRub(
                data.expenses.reduce((s, e) => {
                  const m =
                    e.frequency === "YEARLY"
                      ? e.amount / 12
                      : e.frequency === "QUARTERLY"
                        ? e.amount / 3
                        : e.frequency === "SEMI_ANNUAL"
                          ? e.amount / 6
                          : e.amount;
                  return s + m;
                }, 0),
              )}
            </p>
            <ul className="mt-1 max-h-24 overflow-y-auto text-xs text-muted">
              {data.expenses.map((e) => (
                <li key={e.id}>
                  {e.name}: {formatRub(e.amount)} ({e.frequency})
                </li>
              ))}
              {data.expenses.length === 0 && <li>Нет расходов</li>}
            </ul>
          </div>
          <div>
            <p className="text-xs text-muted">Профицит (лимит взносов)</p>
            <p className="text-lg font-semibold text-brand">
              {formatRub(data.surplusMonthly)} / мес
            </p>
            <p className="text-xs text-muted">{formatRub(data.surplusAnnual)} / год</p>
          </div>
        </div>
      </Card>
      )}

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
                ? compact
                  ? "rounded-lg bg-brand px-2 py-1 text-xs text-white"
                  : "rounded-lg bg-brand px-3 py-2 text-sm text-white"
                : compact
                  ? "rounded-lg border border-border bg-card px-2 py-1 text-xs hover:bg-muted/40"
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
        <div className="ml-auto flex flex-wrap gap-2">
          {!hideMcChart && (
            <Button type="button" variant="secondary" onClick={rerunMc} disabled={mcBusy}>
              {mcBusy ? "…" : "Обновить прогноз риска"}
            </Button>
          )}
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        </div>
      </section>

      <section className={`grid gap-2 ${compact ? "sm:grid-cols-2 lg:grid-cols-4" : "gap-4 sm:grid-cols-2 lg:grid-cols-4"}`}>
        <Card className={compact ? "!p-3" : undefined}>
          <p className={compact ? "text-xs text-muted" : "text-sm text-muted"}>Начальный капитал</p>
          <p className={`mt-1 font-semibold ${compact ? "text-lg" : "text-2xl"}`}>{formatRub(data.initialCapital)}</p>
        </Card>
        <Card className={compact ? "!p-3" : undefined}>
          <p className={compact ? "text-xs text-muted" : "text-sm text-muted"}>Прогнозный капитал в конце</p>
          <p className={`mt-1 font-semibold ${compact ? "text-lg" : "text-2xl"}`}>{formatRub(projection.finalCapital)}</p>
        </Card>
        <Card className={compact ? "!p-3" : undefined}>
          <p className={compact ? "text-xs text-muted" : "text-sm text-muted"}>Типичный результат в конце</p>
          <p className={`mt-1 font-semibold ${compact ? "text-lg" : "text-2xl"}`}>
            {liveMc ? formatRub(liveMc.finalMedian) : "—"}
          </p>
        </Card>
        <Card className={compact ? "!p-3" : undefined}>
          <p className={compact ? "text-xs text-muted" : "text-sm text-muted"}>Успех (капитал &gt; 0)</p>
          <p className={`mt-1 font-semibold ${compact ? "text-lg" : "text-2xl"}`}>
            {liveMc ? `${(liveMc.finalSuccessRate * 100).toFixed(0)}%` : "—"}
          </p>
        </Card>
      </section>

      <Card className={compact ? "space-y-3 !p-3" : "space-y-4"}>
        <h2 className={compact ? "text-sm font-medium" : "font-medium"}>Параметры варианта</h2>
        <div className={`grid ${compact ? "gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "gap-4 sm:grid-cols-2 lg:grid-cols-4"}`}>
          <FormField label="Название">
            <Input
              value={active.name}
              onChange={(e) => updateActive((v) => ({ ...v, name: e.target.value }))}
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
          <FormField label="Возраст на старте">
            <Input
              type="number"
              value={active.age}
              onChange={(e) =>
                updateActive((v) => ({
                  ...v,
                  age: Math.max(0, Number(e.target.value) || 0),
                }))
              }
            />
          </FormField>
          <FormField label="Горизонт, лет" hint={FIELD_HINTS.iplanHorizon}>
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
          <FormField label="Распределение доходностей" hint={FIELD_HINTS.iplanDistribution}>
            <select
              className={fieldCls}
              value={active.distribution}
              onChange={(e) =>
                updateActive((v) => ({
                  ...v,
                  distribution: e.target.value as IPlanDistribution,
                }))
              }
            >
              {DIST_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Ось времени">
            <select
              className={fieldCls}
              value={active.axisMode}
              onChange={(e) =>
                updateActive((v) => ({
                  ...v,
                  axisMode: e.target.value as IPlanVariant["axisMode"],
                }))
              }
            >
              <option value="INDEX">№ по порядку</option>
              <option value="YEAR">Календарный год</option>
              <option value="AGE">Возраст</option>
            </select>
          </FormField>
          <FormField label="Осторожный результат, %" hint="Осторожный исход: редко бывает хуже этого">
            <Input
              type="number"
              value={active.percentileLow}
              onChange={(e) =>
                updateActive((v) => ({
                  ...v,
                  percentileLow: Number(e.target.value) || 10,
                }))
              }
            />
          </FormField>
          <FormField label="Удачный результат, %" hint="Удачный исход: редко бывает лучше этого">
            <Input
              type="number"
              value={active.percentileHigh}
              onChange={(e) =>
                updateActive((v) => ({
                  ...v,
                  percentileHigh: Number(e.target.value) || 90,
                }))
              }
            />
          </FormField>
          <FormField label="Варианты расчёта" hint={FIELD_HINTS.iplanMc}>
            <Input
              type="number"
              value={active.mcRuns}
              onChange={(e) =>
                updateActive((v) => ({
                  ...v,
                  mcRuns: Math.min(2000, Math.max(50, Number(e.target.value) || 500)),
                }))
              }
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Доходность и риск по периодам</h3>
            <button
              type="button"
              className="text-xs text-brand underline"
              onClick={() =>
                updateActive((v) => ({
                  ...v,
                  returnSchedule: [
                    {
                      fromYear: null,
                      ratePct: Math.round(data.suggestedReturnPct * 10) / 10 || 6,
                      volatilityPct:
                        Math.round(data.suggestedVolatilityPct * 10) / 10 || 15,
                    },
                  ],
                }))
              }
            >
              Из активов
            </button>
          </div>
          {active.returnSchedule.map((step, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-4">
              <Input
                placeholder="С года (пусто = база)"
                value={step.fromYear ?? ""}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  updateActive((v) => {
                    const next = [...v.returnSchedule];
                    next[idx] = {
                      ...step,
                      fromYear: raw === "" ? null : Number(raw) || null,
                    };
                    return { ...v, returnSchedule: next };
                  });
                }}
              />
              <Input
                placeholder="Доход % год."
                value={step.ratePct}
                onChange={(e) => {
                  const ratePct = Number(e.target.value.replace(",", ".")) || 0;
                  updateActive((v) => {
                    const next = [...v.returnSchedule];
                    next[idx] = { ...step, ratePct };
                    return { ...v, returnSchedule: next };
                  });
                }}
              />
              <Input
                placeholder="Риск, %"
                value={step.volatilityPct}
                onChange={(e) => {
                  const volatilityPct =
                    Number(e.target.value.replace(",", ".")) || 0;
                  updateActive((v) => {
                    const next = [...v.returnSchedule];
                    next[idx] = { ...step, volatilityPct };
                    return { ...v, returnSchedule: next };
                  });
                }}
              />
              <button
                type="button"
                className="text-left text-xs text-muted underline"
                onClick={() =>
                  updateActive((v) => ({
                    ...v,
                    returnSchedule: v.returnSchedule.filter((_, i) => i !== idx),
                  }))
                }
                disabled={active.returnSchedule.length <= 1}
              >
                Удалить период
              </button>
            </div>
          ))}
          {active.returnSchedule.length < 6 && (
            <Button type="button" variant="secondary" onClick={addReturnStep}>
              + Период доходности
            </Button>
          )}
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-medium">Инвестиционные активы</h2>
        <HelpHint>Те же сущности, что на вкладке «Данные»</HelpHint>
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
                className="w-20"
                defaultValue={String(a.expectedReturnPct)}
                onBlur={(e) => {
                  const n = Number(e.target.value.replace(",", "."));
                  if (!Number.isNaN(n) && n !== a.expectedReturnPct) {
                    void patchAsset(a.id, { expectedReturnPct: n });
                  }
                }}
              />
              <span className="text-muted">%</span>
              <Input
                className="w-20"
                defaultValue={String(a.volatilityPct)}
                onBlur={(e) => {
                  const n = Number(e.target.value.replace(",", "."));
                  if (!Number.isNaN(n) && n !== a.volatilityPct) {
                    void patchAsset(a.id, { volatilityPct: n });
                  }
                }}
              />
              <span className="text-muted">Риск, %</span>
            </li>
          ))}
          {data.capitalAssets.length === 0 && (
            <li className="py-2 text-muted">Нет активов — добавьте ниже</li>
          )}
        </ul>
        <div className="grid gap-3 sm:grid-cols-5">
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
            placeholder="Доход %"
            value={assetDraft.expectedReturnPct}
            onChange={(e) =>
              setAssetDraft((d) => ({ ...d, expectedReturnPct: e.target.value }))
            }
          />
          <Input
            placeholder="Риск, %"
            value={assetDraft.volatilityPct}
            onChange={(e) =>
              setAssetDraft((d) => ({ ...d, volatilityPct: e.target.value }))
            }
          />
          <Button type="button" onClick={addInvestmentAsset}>
            Добавить
          </Button>
        </div>
      </Card>

      <StreamsEditor
        title="Инвестиционные ресурсы (взносы ≤ профицит)"
        streams={active.contributions}
        surplusMonthly={data.surplusMonthly}
        onChange={(contributions) => updateActive((v) => ({ ...v, contributions }))}
        onAdd={() => addStream("contributions")}
      />
      <StreamsEditor
        title="Инвестиционные цели (до 9)"
        streams={active.goals}
        onChange={(goals) => updateActive((v) => ({ ...v, goals }))}
        onAdd={() => addStream("goals")}
      />

      <Card className={compact ? "!p-3" : undefined}>
        <h2 className={compact ? "text-sm font-medium" : "font-medium"}>Прогноз капитала — {active.name}</h2>
        <div className={`mt-3 ${compact ? "h-48" : "h-72"}`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={projection.rows}>
              <defs>
                <linearGradient id="ip" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey={axisKey} fontSize={11} />
              <YAxis
                tickFormatter={(v) =>
                  v >= 1_000_000
                    ? `${(v / 1_000_000).toFixed(1)}M`
                    : `${(v / 1000).toFixed(0)}k`
                }
                fontSize={11}
              />
              <Tooltip formatter={(value) => formatRub(Number(value ?? 0))} />
              <Legend />
              <Area
                type="monotone"
                dataKey="endCapital"
                stroke="#2563eb"
                fill="url(#ip)"
                name="Капитал"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {liveMc && !hideMcChart && (
        <Card>
          <h2 className="font-medium">
            Прогноз риска — осторожный, типичный и удачный результаты
            (P{active.percentileLow} / типичный / P{active.percentileHigh})
          </h2>
          <p className="mt-1 text-xs text-muted">
            Распределение: {DIST_OPTIONS.find((d) => d.value === active.distribution)?.label}.
            Доходность не гарантирована.
          </p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={liveMc.years}>
                <defs>
                  <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis
                  dataKey={active.axisMode === "AGE" ? "age" : "year"}
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
                <Tooltip formatter={(value) => formatRub(Number(value ?? 0))} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="pHigh"
                  stroke="transparent"
                  fill="url(#band)"
                  name={`P${active.percentileHigh}`}
                />
                <Area
                  type="monotone"
                  dataKey="pLow"
                  stroke="transparent"
                  fill="#fff"
                  name={`P${active.percentileLow}`}
                />
                <Line
                  type="monotone"
                  dataKey="median"
                  stroke="#059669"
                  dot={false}
                  strokeWidth={2}
                  name="Типичный"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

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
                <Tooltip formatter={(value) => formatRub(Number(value ?? 0))} />
                <Legend />
                {comparisons.map((c, i) => (
                  <Line
                    key={c.variantId}
                    type="monotone"
                    dataKey={c.variantName}
                    stroke={
                      ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2"][
                        i % 6
                      ]
                    }
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
        <table className="mt-4 w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-2 pr-2">№</th>
              <th className="py-2 pr-2">Год</th>
              <th className="py-2 pr-2">Возраст</th>
              <th className="py-2 pr-2">%</th>
              <th className="py-2 pr-2">Риск, %</th>
              <th className="py-2 pr-2">Начало</th>
              <th className="py-2 pr-2">Рост</th>
              <th className="py-2 pr-2">Доходы</th>
              <th className="py-2 pr-2">Расходы</th>
              <th className="py-2 pr-2">Профицит</th>
              <th className="py-2 pr-2">Взносы</th>
              <th className="py-2 pr-2">Цели</th>
              <th className="py-2 pr-2">Конец</th>
              <th className="py-2">Флаги</th>
            </tr>
          </thead>
          <tbody>
            {projection.rows.map((r) => (
              <tr key={r.year} className="border-b border-border/60">
                <td className="py-1.5 pr-2">{r.index}</td>
                <td className="py-1.5 pr-2">{r.year}</td>
                <td className="py-1.5 pr-2">{r.age}</td>
                <td className="py-1.5 pr-2">{r.ratePct}</td>
                <td className="py-1.5 pr-2">{r.volatilityPct}</td>
                <td className="py-1.5 pr-2">{formatRub(r.startCapital)}</td>
                <td className="py-1.5 pr-2">{formatRub(r.growth)}</td>
                <td className="py-1.5 pr-2">{formatRub(r.incomeAnnual)}</td>
                <td className="py-1.5 pr-2">{formatRub(r.expenseAnnual)}</td>
                <td className="py-1.5 pr-2">{formatRub(r.surplusAnnual)}</td>
                <td className="py-1.5 pr-2">{formatRub(r.contributionsTotal)}</td>
                <td className="py-1.5 pr-2">{formatRub(r.goalsTotal)}</td>
                <td className="py-1.5 pr-2 font-medium">{formatRub(r.endCapital)}</td>
                <td className="py-1.5 font-mono text-xs">
                  {flagsBar(r.contributionFlags)} / {flagsBar(r.goalFlags)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {!hideHistory && <ChangeHistoryPanel onUnauthorized={onUnauthorized} />}
    </div>
  );
}

function StreamsEditor({
  title,
  streams,
  onChange,
  onAdd,
  surplusMonthly,
}: {
  title: string;
  streams: IPlanStream[];
  onChange: (next: IPlanStream[]) => void;
  onAdd: () => void;
  surplusMonthly?: number;
}) {
  function patch(id: string, p: Partial<IPlanStream>) {
    onChange(streams.map((s) => (s.id === id ? { ...s, ...p } : s)));
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{title}</h2>
        {streams.length < 9 && (
          <Button type="button" variant="secondary" onClick={onAdd}>
            + Строка
          </Button>
        )}
      </div>
      {streams.map((s, idx) => {
        const locked = s.linkedEntityId === "__surplus__";
        return (
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
              {idx + 1}. {locked ? "из профицита (сквозной)" : "активна"}
            </label>
            <Input
              className="sm:col-span-2"
              placeholder="Название"
              value={s.name}
              disabled={locked}
              onChange={(e) => patch(s.id, { name: e.target.value })}
            />
            <Input
              placeholder="Сумма"
              value={
                locked && surplusMonthly != null
                  ? formatMoneyInput(String(Math.max(0, Math.round(surplusMonthly))))
                  : s.amount
                    ? formatMoneyInput(String(s.amount))
                    : ""
              }
              disabled={locked}
              onChange={(e) => {
                if (locked) return;
                const n = parsePositiveNumber(e.target.value, "Сумма");
                patch(s.id, { amount: n.ok ? n.value : 0 });
              }}
            />
            <select
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm disabled:opacity-60"
              value={s.frequency}
              disabled={locked}
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
              value={s.startYear}
              onChange={(e) =>
                patch(s.id, { startYear: Number(e.target.value) || s.startYear })
              }
            />
            <Input
              type="number"
              value={s.endYear}
              onChange={(e) =>
                patch(s.id, { endYear: Number(e.target.value) || s.endYear })
              }
            />
            {!locked && (
              <button
                type="button"
                className="text-left text-xs text-muted underline sm:col-span-6"
                onClick={() => onChange(streams.filter((x) => x.id !== s.id))}
              >
                Удалить
              </button>
            )}
          </div>
        );
      })}
    </Card>
  );
}
