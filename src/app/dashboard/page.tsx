"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Disclaimer } from "@/components/Disclaimer";
import {
  DashboardShell,
  type DashboardTab,
} from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NetWorthChart } from "@/components/charts/NetWorthChart";
import { MonteCarloBandChart } from "@/components/charts/MonteCarloBandChart";
import { GoalsPanel } from "@/components/finance/GoalsPanel";
import {
  FinanceDataPanel,
  type FinanceDataStatus,
} from "@/components/finance/FinanceDataPanel";
import { HomeDashboard } from "@/components/finance/HomeDashboard";
import { InvestmentPlanPanel } from "@/components/finance/InvestmentPlanPanel";
import { MacroSettingsCard } from "@/components/finance/MacroSettingsCard";
import { ChangeHistoryPanel } from "@/components/finance/ChangeHistoryPanel";
import { ScenariosPanel } from "@/components/scenarios/ScenariosPanel";
import { FormError } from "@/components/ui/FormError";
import { HelpHint } from "@/components/ui/FormField";
import { toast } from "@/components/ui/ToastProvider";
import { FEATURE_HINTS } from "@/content/help";
import { readApiError } from "@/shared/api-client";
import type {
  Asset,
  Expense,
  Goal,
  Income,
  Liability,
} from "@/shared/types";
import type { HomeDashboardInput } from "@/modules/dashboard/insights";

interface Projection {
  result: {
    monthly: Array<{ month: number; netWorth: number; cashflow: number }>;
    goalFunding: Array<{
      goalId: string;
      requiredMonthlySaving: number;
      projectedBalanceAtTarget: number;
      inflationAdjustedTarget: number;
    }>;
    summary: {
      finalNetWorth: number;
      avgMonthlySurplus: number;
      recommendedMonthlySaving: number;
    };
  };
  scenario: string;
  scenarioId: string | null;
  isActive: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<DashboardTab>("home");
  const [dataStatus, setDataStatus] = useState<FinanceDataStatus | null>(null);
  const [goalCount, setGoalCount] = useState(0);
  const [homeInput, setHomeInput] = useState<HomeDashboardInput | null>(null);
  const [homeLoading, setHomeLoading] = useState(true);
  const [projection, setProjection] = useState<Projection | null>(null);
  const [scenarios, setScenarios] = useState<
    Array<{ id: string; name: string; isActive: boolean; rules: unknown }>
  >([]);
  const [simJob, setSimJob] = useState<{
    id: string;
    status: string;
    progressPct: number;
    result?: {
      goalProbabilities: Array<{
        goalId: string;
        probability: number;
        median: number;
        p5: number;
        p95: number;
      }>;
      samplePaths: Array<{ label: string; netWorth: number[] }>;
    };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [simError, setSimError] = useState("");
  const [simStarting, setSimStarting] = useState(false);
  const [addingAsset, setAddingAsset] = useState(false);
  const [viewScenarioId, setViewScenarioId] = useState<string | null>(null);
  const [projectionLoading, setProjectionLoading] = useState(false);

  const simBusy =
    simStarting ||
    simJob?.status === "PENDING" ||
    simJob?.status === "RUNNING";

  const handleUnauthorized = useCallback(
    (res: Response) => {
      if (res.status === 401) {
        router.push("/login?session=expired");
        return true;
      }
      return false;
    },
    [router],
  );

  const loadHomeSnapshot = useCallback(async () => {
    setHomeLoading(true);
    try {
      const [aRes, lRes, iRes, eRes, gRes, sRes] = await Promise.all([
        fetch("/api/assets", { cache: "no-store" }),
        fetch("/api/liabilities", { cache: "no-store" }),
        fetch("/api/incomes", { cache: "no-store" }),
        fetch("/api/expenses", { cache: "no-store" }),
        fetch("/api/goals", { cache: "no-store" }),
        fetch("/api/scenarios", { cache: "no-store" }),
      ]);
      if (
        handleUnauthorized(aRes) ||
        handleUnauthorized(lRes) ||
        handleUnauthorized(iRes) ||
        handleUnauthorized(eRes) ||
        handleUnauthorized(gRes) ||
        handleUnauthorized(sRes)
      )
        return;
      const assets: Asset[] = aRes.ok ? await aRes.json() : [];
      const liabilities: Liability[] = lRes.ok ? await lRes.json() : [];
      const incomes: Income[] = iRes.ok ? await iRes.json() : [];
      const expenses: Expense[] = eRes.ok ? await eRes.json() : [];
      const goals: Goal[] = gRes.ok ? await gRes.json() : [];
      const scenariosPayload = sRes.ok ? await sRes.json() : { scenarios: [] };
      const scenarioList = (scenariosPayload.scenarios ?? []) as Array<{
        id: string;
      }>;
      setGoalCount(goals.length);
      setHomeInput({
        assets,
        liabilities,
        incomes,
        expenses,
        goals,
        scenarioCount: scenarioList.length,
      });
    } finally {
      setHomeLoading(false);
    }
  }, [handleUnauthorized]);

  const loadProjection = useCallback(
    async (scenarioId?: string) => {
      const id = scenarioId ?? viewScenarioId;
      if (!id) return;
      setProjectionLoading(true);
      try {
        const res = await fetch(
          `/api/plan/projection?scenarioId=${encodeURIComponent(id)}`,
        );
        if (handleUnauthorized(res)) return;
        if (res.ok) setProjection(await res.json());
      } finally {
        setProjectionLoading(false);
      }
    },
    [handleUnauthorized, viewScenarioId],
  );

  const loadScenarios = useCallback(async () => {
    const res = await fetch("/api/scenarios");
    if (handleUnauthorized(res)) return;
    if (res.ok) {
      const data = await res.json();
      setScenarios(data.scenarios);
      return data.scenarios as Array<{
        id: string;
        name: string;
        isActive: boolean;
      }>;
    }
    return [];
  }, [handleUnauthorized]);

  const refreshAfterData = useCallback(async () => {
    await loadProjection();
    await loadHomeSnapshot();
  }, [loadProjection, loadHomeSnapshot]);

  const enrichedHome: HomeDashboardInput | null = homeInput
    ? {
        ...homeInput,
        recommendedMonthlySaving:
          projection?.result.summary.recommendedMonthlySaving,
        goalProbabilities: simJob?.result?.goalProbabilities,
      }
    : null;

  useEffect(() => {
    loadScenarios().finally(() => setLoading(false));
    loadHomeSnapshot();
  }, [loadScenarios, loadHomeSnapshot]);

  useEffect(() => {
    if (viewScenarioId !== null) return;
    const active = scenarios.find((s) => s.isActive);
    setViewScenarioId(active?.id ?? "base");
  }, [scenarios, viewScenarioId]);

  useEffect(() => {
    if (viewScenarioId) loadProjection(viewScenarioId);
  }, [viewScenarioId, loadProjection]);

  async function runSimulation() {
    setSimError("");
    setSimStarting(true);
    try {
      const res = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numRuns: 5000,
          scenarioId: viewScenarioId === "base" ? undefined : viewScenarioId ?? undefined,
        }),
      });
      if (handleUnauthorized(res)) return;
      if (!res.ok) {
        const { message } = await readApiError(res);
        setSimError(message);
        toast.error(message);
        return;
      }
      const job = await res.json();
      setSimJob(job);
      toast.success("Расчёт Monte Carlo запущен");
      pollJob(job.id);
    } catch {
      const message = "Не удалось запустить расчёт. Проверьте подключение и попробуйте снова.";
      setSimError(message);
      toast.error(message);
    } finally {
      setSimStarting(false);
    }
  }

  function pollJob(id: string) {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/simulations/${id}`);
      if (!res.ok) return;
      const job = await res.json();
      setSimJob(job);
      if (job.status === "COMPLETED") {
        clearInterval(interval);
        loadProjection();
        toast.success("Расчёт Monte Carlo завершён");
      }
      if (job.status === "FAILED") {
        clearInterval(interval);
        const message =
          job.errorMessage ??
          "Расчёт завершился с ошибкой. Проверьте данные плана и попробуйте снова";
        setSimError(message);
        toast.error(message);
      }
    }, 2000);
  }

  async function activateScenario(id: string) {
    const res = await fetch(`/api/scenarios/${id}/activate`, { method: "POST" });
    if (handleUnauthorized(res)) return;
    if (!res.ok) {
      const { message } = await readApiError(res);
      setSimError(message);
      toast.error(message);
      return;
    }
    await Promise.all([loadScenarios(), loadProjection(id), loadHomeSnapshot()]);
    setViewScenarioId(id);
    toast.success("Сценарий применён");
  }

  async function quickAddAsset() {
    setAddingAsset(true);
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Портфель",
          type: "BROKERAGE",
          assetClass: "INVESTMENT",
          currentValue: 3_000_000,
          expectedReturnPct: 7,
          volatilityPct: 12,
        }),
      });
      if (handleUnauthorized(res)) return;
      if (!res.ok) {
        const { message } = await readApiError(res);
        toast.error(message);
        return;
      }
      await refreshAfterData();
      toast.success("Демо-портфель добавлен");
    } catch {
      toast.error("Не удалось добавить портфель. Проверьте подключение и попробуйте снова.");
    } finally {
      setAddingAsset(false);
    }
  }

  return (
    <DashboardShell tab={tab} onTabChange={setTab}>
      <Disclaimer className="mb-6" />

      {loading && tab !== "home" && <p className="text-muted">Загрузка…</p>}

        {tab === "home" && (
          <HomeDashboard
            input={enrichedHome}
            loading={homeLoading}
            onNavigate={setTab}
          />
        )}

        {tab === "plan" && projection && viewScenarioId && (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <HelpHint>
                Выберите сценарий для просмотра прогноза. Активный сценарий отмечен — его можно сменить на вкладке «Сценарии».
              </HelpHint>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted">Отображать:</span>
                <select
                  value={viewScenarioId}
                  onChange={(e) => setViewScenarioId(e.target.value)}
                  disabled={projectionLoading}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                >
                  <option value="base">Базовый (без правил)</option>
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.isActive ? " • активный" : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <section className="grid gap-4 sm:grid-cols-3">
              <SummaryCard
                title="Рекомендуемый взнос / мес"
                hint="Сколько откладывать ежемесячно, чтобы успеть к целям"
                value={projection.result.summary.recommendedMonthlySaving}
              />
              <SummaryCard
                title="Средний профицит / мес"
                hint="Доходы минус расходы и долги в среднем за горизонт"
                value={projection.result.summary.avgMonthlySurplus}
              />
              <SummaryCard
                title="Чистые активы (конец горизонта)"
                hint="Прогноз накоплений к концу выбранного периода"
                value={projection.result.summary.finalNetWorth}
              />
            </section>

            <Card>
              <h2 className="font-medium">
                Timeline — {projection.scenario}
                {projection.isActive && (
                  <span className="ml-2 text-xs font-normal text-brand">активный</span>
                )}
              </h2>
              {projectionLoading && (
                <p className="mt-1 text-xs text-muted">Пересчёт…</p>
              )}
              <NetWorthChart data={projection.result.monthly} />
            </Card>

            {simJob?.result && (
              <Card>
                <h2 className="font-medium">Monte Carlo</h2>
                <MonteCarloBandChart paths={simJob.result.samplePaths} />
                <ul className="mt-4 space-y-2 text-sm">
                  {simJob.result.goalProbabilities.map((g) => (
                    <li key={g.goalId}>
                      Цель: вероятность {(g.probability * 100).toFixed(1)}%,
                      медиана {formatRub(g.median)}, 5%: {formatRub(g.p5)},
                      95%: {formatRub(g.p95)}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <HelpHint>{FEATURE_HINTS.monteCarlo}</HelpHint>
              </div>
              <Button type="button" onClick={runSimulation} disabled={simBusy}>
                {simBusy ? "Расчёт…" : "Запустить Monte Carlo (5k)"}
              </Button>
              {simJob && (
                <span className="text-sm text-muted">
                  Статус: {simJob.status} ({simJob.progressPct}%)
                </span>
              )}
            </div>
            <FormError message={simError} />
          </div>
        )}

        {tab === "iplan" && (
          <InvestmentPlanPanel
            onUnauthorized={handleUnauthorized}
            onAssetsChanged={refreshAfterData}
          />
        )}

        {tab === "assets" && (
          <div className="space-y-6">
            <CfpProgressCard
              status={dataStatus}
              goalCount={goalCount}
              onGoPlan={() => setTab("plan")}
              onGoIplan={() => setTab("iplan")}
            />
            <FinanceDataPanel
              onQuickAdd={quickAddAsset}
              onRefresh={refreshAfterData}
              onUnauthorized={handleUnauthorized}
              addingAsset={addingAsset}
              onStatusChange={setDataStatus}
            />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Шаг 3 · Цели и горизонт
              </p>
              <h2 className="mt-1 font-medium">Цели и макропараметры</h2>
              <HelpHint className="mt-1">{FEATURE_HINTS.goalsStep}</HelpHint>
            </div>
            <MacroSettingsCard
              onUnauthorized={handleUnauthorized}
              onSaved={refreshAfterData}
            />
            <GoalsPanel
              onSaved={refreshAfterData}
              onUnauthorized={handleUnauthorized}
              onCountChange={setGoalCount}
            />
            <ChangeHistoryPanel onUnauthorized={handleUnauthorized} />
          </div>
        )}

        {tab === "scenarios" && (
          <ScenariosPanel
            scenarios={scenarios}
            onRefresh={loadScenarios}
            onActivate={activateScenario}
          />
        )}

        {tab === "export" && (
          <Card className="space-y-6">
            <div>
              <h2 className="font-medium">PDF-отчёт</h2>
              <HelpHint className="mt-1">{FEATURE_HINTS.pdfExport}</HelpHint>
              <a
                href="/api/export/pdf"
                className="mt-3 inline-block rounded-lg bg-sidebar px-4 py-2 text-sm text-white hover:opacity-90"
              >
                Скачать PDF
              </a>
            </div>
            <CsvImport />
          </Card>
        )}
    </DashboardShell>
  );
}

function SummaryCard({
  title,
  hint,
  value,
}: {
  title: string;
  hint?: string;
  value: number;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{title}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted/80">{hint}</p>}
      <p className="mt-1 text-lg font-semibold">{formatRub(value)}</p>
    </Card>
  );
}

function formatRub(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n);
}

function CfpProgressCard({
  status,
  goalCount,
  onGoPlan,
  onGoIplan,
}: {
  status: FinanceDataStatus | null;
  goalCount: number;
  onGoPlan: () => void;
  onGoIplan: () => void;
}) {
  const step1 = (status?.assetCount ?? 0) + (status?.liabilityCount ?? 0) > 0;
  const step2 = (status?.incomeCount ?? 0) > 0 && (status?.expenseCount ?? 0) > 0;
  const step3 = goalCount > 0;
  const steps = [
    { done: step1, label: "1. Точка 0" },
    { done: step2, label: "2. Денежный поток" },
    { done: step3, label: "3. Цели" },
  ];
  const next = !step1
    ? "Зафиксируйте активы и/или пассивы"
    : !step2
      ? "Добавьте доходы и расходы"
      : !step3
        ? "Добавьте хотя бы одну цель"
        : "Данные готовы — откройте «План» или «Инвест-план»";

  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
      <div>
        <p className="text-sm font-medium">Прогресс заполнения (CFP)</p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          {steps.map((s) => (
            <span key={s.label} className={s.done ? "text-success" : "text-muted"}>
              {s.done ? "✓" : "○"} {s.label}
            </span>
          ))}
        </div>
        <HelpHint className="mt-2">{next}</HelpHint>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={onGoPlan}>
          К плану
        </Button>
        <Button type="button" variant="secondary" onClick={onGoIplan}>
          К инвест-плану
        </Button>
      </div>
    </Card>
  );
}

function CsvImport() {
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult("");
    setError("");

    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/import/csv", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const fix = data.fix ? ` ${data.fix}` : "";
      const message = (data.error ?? "Ошибка импорта") + fix;
      setError(message);
      toast.error(message);
      return;
    }

    const lines = [
      `Импортировано: ${data.created} из ${data.total}`,
      data.skipped ? `Пропущено: ${data.skipped}` : "",
    ].filter(Boolean);

    if (data.errors?.length) {
      const details = data.errors
        .slice(0, 5)
        .map(
          (err: { row: number; message: string; fix: string }) =>
            `Строка ${err.row}: ${err.message}. ${err.fix}`,
        )
        .join(" ");
      lines.push(details);
      if (data.errors.length > 5) {
        lines.push(`…и ещё ${data.errors.length - 5} ошибок`);
      }
    }

    const message = lines.join(". ");
    setResult(message);
    toast.success(`Импортировано: ${data.created} из ${data.total}`);
    e.target.value = "";
  }

  return (
    <div>
      <h3 className="font-medium">Импорт CSV</h3>
      <HelpHint className="mt-1">{FEATURE_HINTS.csvImport}</HelpHint>
      <p className="mt-2 text-xs text-muted">
        Колонки: type (asset|income|expense), name, amount, category
      </p>
      <input type="file" accept=".csv" onChange={onFile} className="mt-3 text-sm" />
      {result && <p className="mt-2 text-sm text-success">{result}</p>}
      <FormError message={error} />
    </div>
  );
}
