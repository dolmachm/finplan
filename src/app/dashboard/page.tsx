"use client";

/**
 * Dashboard: summary-first на Home; полный snapshot и projection — лениво
 * по вкладкам. Тяжёлые панели через next/dynamic.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Disclaimer } from "@/components/Disclaimer";
import {
  DashboardShell,
  type DashboardTab,
} from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HomeDashboard } from "@/components/finance/HomeDashboard";
import { StageHelp } from "@/components/onboarding/StageLearningCard";
import { StepContinueBar } from "@/components/onboarding/StepContinueBar";
import { FormError } from "@/components/ui/FormError";
import { HelpHint } from "@/components/ui/FormField";
import { SubNav } from "@/components/ui/SubNav";
import { toast } from "@/components/ui/ToastProvider";
import { FEATURE_HINTS } from "@/content/help";
import { readApiError, NETWORK_ERROR_MESSAGE } from "@/shared/api-client";
import { apiFetch, apiFetchJson } from "@/shared/api-fetch";
import { ensureOnlineForWrite } from "@/shared/offline";
import {
  nextIncompleteStep,
  stepDoneForSub,
  type DataSub,
} from "@/modules/dashboard/journey";
import {
  FinanceStoreProvider,
  useFinanceStore,
} from "@/modules/finance/finance-store";
import type { FinanceDataStatus } from "@/components/finance/FinanceDataPanel";
import type { PlanSection } from "@/components/plan/PlanWorkspace";
import type { PlanProjection } from "@/modules/plan/projection-types";
import type { Scenario } from "@/shared/types";

const FinanceDataPanel = dynamic(
  () =>
    import("@/components/finance/FinanceDataPanel").then(
      (m) => m.FinanceDataPanel,
    ),
  { ssr: false, loading: () => <p className="text-muted">Загрузка…</p> },
);

const GoalsPanel = dynamic(
  () =>
    import("@/components/finance/GoalsPanel").then((m) => m.GoalsPanel),
  { ssr: false, loading: () => <p className="text-muted">Загрузка…</p> },
);

const MacroSettingsCard = dynamic(
  () =>
    import("@/components/finance/MacroSettingsCard").then(
      (m) => m.MacroSettingsCard,
    ),
  { ssr: false },
);

const ChangeHistoryPanel = dynamic(
  () =>
    import("@/components/finance/ChangeHistoryPanel").then(
      (m) => m.ChangeHistoryPanel,
    ),
  { ssr: false },
);

const PlanWorkspace = dynamic(
  () =>
    import("@/components/plan/PlanWorkspace").then((m) => m.PlanWorkspace),
  { ssr: false, loading: () => <p className="text-muted">Загрузка плана…</p> },
);

const ReportEditor = dynamic(
  () =>
    import("@/components/reports/ReportEditor").then((m) => m.ReportEditor),
  { ssr: false, loading: () => <p className="text-muted">Загрузка…</p> },
);

type ExportSub = "report" | "csv";

const DATA_SUB_ITEMS = [
  { id: "balance" as const, label: "Баланс" },
  { id: "cashflow" as const, label: "Поток" },
  { id: "goals" as const, label: "Цели" },
];

const PLAN_SUB_ITEMS = [
  { id: "overview" as const, label: "Обзор" },
  { id: "montecarlo" as const, label: "Прогноз риска" },
  { id: "iplan" as const, label: "Инвест-план" },
  { id: "scenarios" as const, label: "Сценарии" },
];

const EXPORT_SUB_ITEMS = [
  { id: "report" as const, label: "Отчёт PDF" },
  { id: "csv" as const, label: "CSV" },
];

export default function DashboardPage() {
  return (
    <FinanceStoreProvider>
      <DashboardPageInner />
    </FinanceStoreProvider>
  );
}

function DashboardPageInner() {
  const store = useFinanceStore();
  const {
    loadSummary,
    ensureSnapshot,
    summaryLoading,
    entitiesLoading,
    entitiesReady,
    summary,
    score,
    homeInput,
    scenarios,
    assets,
    liabilities,
    incomes,
    expenses,
    goals,
    setScenarios,
    setEnrichment,
    upsert,
    entitiesRevision,
  } = store;

  const [tab, setTab] = useState<DashboardTab>("home");
  const [dataSub, setDataSub] = useState<DataSub>("balance");
  const [planSub, setPlanSub] = useState<PlanSection>("overview");
  const [exportSub, setExportSub] = useState<ExportSub>("report");
  const [projection, setProjection] = useState<PlanProjection | null>(null);
  const [simJob, setSimJob] = useState<{
    id: string;
    status: string;
    progressPct: number;
    startedAt?: string | null;
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
  const [simError, setSimError] = useState("");
  const [simStarting, setSimStarting] = useState(false);
  const [addingAsset, setAddingAsset] = useState(false);
  const [viewScenarioId, setViewScenarioId] = useState<string | null>(null);
  const [projectionLoading, setProjectionLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const simBusy =
    simStarting ||
    simJob?.status === "PENDING" ||
    simJob?.status === "RUNNING";

  const needsEntities =
    tab === "assets" || tab === "plan" || tab === "export";

  // Пока snapshot не загружен — прогресс из summary.counts; иначе из списков.
  const dataStatus: FinanceDataStatus = summary
    ? {
        assetCount: summary.counts.assets,
        liabilityCount: summary.counts.liabilities,
        incomeCount: summary.counts.incomes,
        expenseCount: summary.counts.expenses,
        netWorthApprox: summary.metrics.netWorth,
      }
    : {
        assetCount: assets.length,
        liabilityCount: liabilities.length,
        incomeCount: incomes.length,
        expenseCount: expenses.length,
        netWorthApprox:
          assets.reduce((s, a) => s + a.currentValue, 0) -
          liabilities.reduce((s, l) => s + l.remainingBalance, 0),
      };

  const goalCount = summary?.counts.goals ?? goals.length;

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (needsEntities) void ensureSnapshot();
  }, [needsEntities, ensureSnapshot]);

  useEffect(() => {
    if (viewScenarioId !== null) return;
    // До snapshot достаточно "base"; после — активный сценарий пользователя.
    if (!entitiesReady) {
      if (summary) setViewScenarioId("base");
      return;
    }
    const active = scenarios.find((s) => s.isActive);
    setViewScenarioId(active?.id ?? "base");
  }, [scenarios, viewScenarioId, entitiesReady, summary]);

  useEffect(() => {
    if (projection?.result.summary) {
      setEnrichment({
        recommendedMonthlySaving:
          projection.result.summary.recommendedMonthlySaving,
        projectionCashflowAvg: projection.result.summary.avgMonthlySurplus,
      });
    }
  }, [projection, setEnrichment]);

  useEffect(() => {
    if (simJob?.result?.goalProbabilities) {
      setEnrichment({
        goalProbabilities: simJob.result.goalProbabilities,
      });
    }
  }, [simJob, setEnrichment]);

  const loadProjection = useCallback(async (scenarioId?: string) => {
    const id = scenarioId ?? viewScenarioId;
    if (!id) return;
    setProjectionLoading(true);
    try {
      const res = await apiFetch(
        `/api/plan/projection?scenarioId=${encodeURIComponent(id)}`,
      );
      if (!res) return;
      if (res.ok) {
        setProjection(await res.json());
      } else {
        const { message } = await readApiError(res);
        toast.error(
          message ||
            "Не удалось загрузить прогноз. Проверьте данные на вкладке «Данные».",
        );
      }
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setProjectionLoading(false);
    }
  }, [viewScenarioId]);

  useEffect(() => {
    // iplan/scenarios не ждут projection — экономим Redis+CPU на вкладке.
    if (
      tab === "plan" &&
      viewScenarioId &&
      (planSub === "overview" || planSub === "montecarlo")
    ) {
      void loadProjection(viewScenarioId);
    }
  }, [tab, viewScenarioId, planSub, loadProjection, entitiesRevision]);

  useEffect(() => {
    // Интервал опроса симуляции не должен жить после ухода со страницы.
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function refreshScenarios() {
    const result = await apiFetchJson<{ scenarios: Scenario[] }>(
      "/api/scenarios",
    );
    if (result.ok) {
      setScenarios(result.data.scenarios);
    }
  }

  function notifyRiskReady(ok: boolean, detail?: string) {
    toast[ok ? "success" : "error"](
      ok ? "Прогноз риска готов" : (detail ?? "Расчёт риска не удался"),
    );
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification(ok ? "FinPlan: прогноз риска готов" : "FinPlan: ошибка расчёта", {
          body: ok
            ? "Можно открыть вкладку «Прогноз риска» и посмотреть график."
            : detail,
        });
      }
    }
  }

  function pollJob(id: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res = await apiFetch(`/api/simulations/${id}`);
      if (!res?.ok) return;
      const job = await res.json();
      setSimJob(job);
      if (job.status === "COMPLETED") {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        void loadProjection();
        notifyRiskReady(true);
      }
      if (job.status === "FAILED") {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        const message =
          job.errorMessage ??
          "Расчёт завершился с ошибкой. Проверьте данные плана и попробуйте снова";
        setSimError(message);
        notifyRiskReady(false, message);
      }
    }, 1500);
  }

  async function runSimulation() {
    if (!ensureOnlineForWrite()) return;
    setSimError("");
    setSimStarting(true);
    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "default") {
          void Notification.requestPermission();
        }
      }
      toast.success(
        "Считаем риски (~30–90 сек). Пришлём уведомление, когда будет готово.",
      );
      const res = await apiFetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numRuns: 1200,
          scenarioId:
            viewScenarioId === "base"
              ? undefined
              : (viewScenarioId ?? undefined),
        }),
      });
      if (!res) return;
      if (!res.ok) {
        const { message } = await readApiError(res);
        setSimError(message);
        toast.error(message);
        return;
      }
      const job = await res.json();
      setSimJob(job);
      if (job.status === "COMPLETED") {
        void loadProjection();
        notifyRiskReady(true);
      } else if (job.status === "FAILED") {
        const message = job.errorMessage ?? "Ошибка расчёта";
        setSimError(message);
        notifyRiskReady(false, message);
      } else {
        pollJob(job.id);
      }
    } catch {
      const message = NETWORK_ERROR_MESSAGE;
      setSimError(message);
      toast.error(message);
    } finally {
      setSimStarting(false);
    }
  }

  async function activateScenario(id: string) {
    if (!ensureOnlineForWrite()) return;
    const res = await apiFetch(`/api/scenarios/${id}/activate`, {
      method: "POST",
    });
    if (!res) return;
    if (!res.ok) {
      const { message } = await readApiError(res);
      setSimError(message);
      toast.error(message);
      return;
    }
    await refreshScenarios();
    setViewScenarioId(id);
    toast.success("Сценарий применён");
  }

  async function quickAddAsset() {
    if (!ensureOnlineForWrite()) return;
    setAddingAsset(true);
    try {
      const res = await apiFetch("/api/assets", {
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
      if (!res) return;
      if (!res.ok) {
        const { message } = await readApiError(res);
        toast.error(message);
        return;
      }
      const asset = await res.json();
      upsert("assets", asset);
      toast.success("Демо-портфель добавлен");
    } catch {
      toast.error(
        "Не удалось добавить портфель. Проверьте подключение и попробуйте снова.",
      );
    } finally {
      setAddingAsset(false);
    }
  }

  const journeySteps = {
    step1: (dataStatus.assetCount ?? 0) + (dataStatus.liabilityCount ?? 0) > 0,
    step2: (dataStatus.incomeCount ?? 0) > 0 && (dataStatus.expenseCount ?? 0) > 0,
    step3: goalCount > 0,
    completenessPct: 0,
  };
  journeySteps.completenessPct = Math.round(
    ((journeySteps.step1 ? 1 : 0) +
      (journeySteps.step2 ? 1 : 0) +
      (journeySteps.step3 ? 1 : 0)) /
      3 *
      100,
  );

  function navigateHome(
    nextTab: DashboardTab,
    opts?: { dataSub?: DataSub },
  ) {
    if (opts?.dataSub) setDataSub(opts.dataSub);
    setTab(nextTab);
  }

  function goPlan() {
    setPlanSub("overview");
    setTab("plan");
  }

  const dataHelpProminent = !stepDoneForSub(dataSub, journeySteps);
  const planHelpProminent = journeySteps.completenessPct === 0;

  return (
    <DashboardShell
      tab={tab}
      onTabChange={setTab}
      supportSubTab={
        tab === "assets"
          ? dataSub
          : tab === "plan"
            ? planSub
            : tab === "export"
              ? exportSub
              : null
      }
    >
      <Disclaimer className="mb-6" />

      {tab === "home" && (
        <HomeDashboard
          metrics={summary?.metrics ?? null}
          score={score}
          corridor={summary?.corridor ?? null}
          loading={summaryLoading && !summary}
          onNavigate={navigateHome}
        />
      )}

      {tab === "plan" && (
        <div className="space-y-4">
          <SubNav
            items={PLAN_SUB_ITEMS}
            value={planSub}
            onChange={setPlanSub}
          />
          {journeySteps.completenessPct < 100 && (
            <PlanIncompleteBanner
              steps={journeySteps}
              onContinue={(sub) => {
                setDataSub(sub);
                setTab("assets");
              }}
            />
          )}
          {!entitiesReady || entitiesLoading ? (
            <p className="text-muted">Загрузка плана…</p>
          ) : viewScenarioId ? (
            <div className="space-y-4">
              {planHelpProminent ? <StageHelp stage="plan" prominent /> : null}
              <PlanWorkspace
                section={planSub}
                insightsInput={homeInput}
                score={score}
                projection={projection}
                projectionLoading={projectionLoading}
                viewScenarioId={viewScenarioId}
                onViewScenarioChange={setViewScenarioId}
                scenarios={scenarios}
                onActivateScenario={activateScenario}
                onScenariosRefresh={refreshScenarios}
                simJob={simJob}
                simBusy={simBusy}
                simError={simError}
                onRunSimulation={runSimulation}
              />
              {!planHelpProminent ? (
                <StageHelp stage="plan" prominent={false} />
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {tab === "assets" && (
        <div className="space-y-6">
          <SubNav
            items={DATA_SUB_ITEMS.map((item) => ({
              ...item,
              label:
                item.id === "balance"
                  ? `${journeySteps.step1 ? "✓ " : ""}${item.label}`
                  : item.id === "cashflow"
                    ? `${journeySteps.step2 ? "✓ " : ""}${item.label}`
                    : `${journeySteps.step3 ? "✓ " : ""}${item.label}`,
            }))}
            value={dataSub}
            onChange={setDataSub}
          />
          <CfpProgressCard
            steps={journeySteps}
            current={dataSub}
            onGoPlan={goPlan}
            onGoSub={setDataSub}
          />
          {!entitiesReady || entitiesLoading ? (
            <p className="text-muted">Загрузка данных…</p>
          ) : (
            <>
              {dataHelpProminent ? (
                <StageHelp stage={dataSub} prominent />
              ) : null}
              {(dataSub === "balance" || dataSub === "cashflow") && (
                <FinanceDataPanel
                  mode={dataSub}
                  onQuickAdd={quickAddAsset}
                  addingAsset={addingAsset}
                  score={score}
                />
              )}
              {dataSub === "goals" && (
                <div className="space-y-6">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      Шаг 3 · Цели и горизонт
                    </p>
                    <h2 className="mt-1 font-medium">Цели и макропараметры</h2>
                    <HelpHint className="mt-1">{FEATURE_HINTS.goalsStep}</HelpHint>
                  </div>
                  <MacroSettingsCard />
                  <GoalsPanel score={score} />
                  <ChangeHistoryPanel />
                </div>
              )}
              <StepContinueBar
                current={dataSub}
                steps={journeySteps}
                onGoSub={setDataSub}
                onGoPlan={goPlan}
              />
              {!dataHelpProminent ? (
                <StageHelp stage={dataSub} prominent={false} />
              ) : null}
            </>
          )}
        </div>
      )}

      {tab === "export" && (
        <div>
          <SubNav
            items={EXPORT_SUB_ITEMS}
            value={exportSub}
            onChange={setExportSub}
          />
          <Card className="space-y-6">
            {exportSub === "report" && <ReportEditor />}
            {exportSub === "csv" && <CsvImport />}
          </Card>
        </div>
      )}
    </DashboardShell>
  );
}

function CfpProgressCard({
  steps,
  current,
  onGoPlan,
  onGoSub,
}: {
  steps: {
    step1: boolean;
    step2: boolean;
    step3: boolean;
    completenessPct: number;
  };
  current: DataSub;
  onGoPlan: () => void;
  onGoSub: (sub: DataSub) => void;
}) {
  const items = [
    { done: steps.step1, label: "1. Точка 0", sub: "balance" as const },
    { done: steps.step2, label: "2. Денежный поток", sub: "cashflow" as const },
    { done: steps.step3, label: "3. Цели", sub: "goals" as const },
  ];
  const next = nextIncompleteStep(steps);
  const allDone = steps.completenessPct >= 100;

  return (
    <Card className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">
          Прогресс заполнения · {steps.completenessPct}%
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          {items.map((s) => {
            const active = current === s.sub;
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => onGoSub(s.sub)}
                className={
                  active
                    ? "font-medium text-brand underline"
                    : s.done
                      ? "text-accent hover:underline"
                      : "text-muted hover:text-foreground hover:underline"
                }
              >
                {s.done ? "✓" : "○"} {s.label}
              </button>
            );
          })}
        </div>
        <HelpHint className="mt-2">
          {allDone ? "Данные готовы — откройте «План»." : next.hint}
        </HelpHint>
      </div>
      <Button
        type="button"
        variant={allDone ? "primary" : "secondary"}
        onClick={() => {
          if (allDone) onGoPlan();
          else onGoSub(next.dataSub);
        }}
      >
        {allDone ? "К плану" : next.cta}
      </Button>
    </Card>
  );
}

function PlanIncompleteBanner({
  steps,
  onContinue,
}: {
  steps: {
    step1: boolean;
    step2: boolean;
    step3: boolean;
    completenessPct: number;
  };
  onContinue: (sub: DataSub) => void;
}) {
  const next = nextIncompleteStep(steps);
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 border-amber-200 bg-amber-50/60">
      <div>
        <p className="text-sm font-medium">План точнее с полными данными</p>
        <p className="mt-1 text-sm text-muted">
          Заполнено {steps.completenessPct}%. Следующий шаг — {next.label}.
        </p>
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={() => onContinue(next.dataSub)}
      >
        {next.cta}
      </Button>
    </Card>
  );
}

function CsvImport() {
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const { refresh } = useFinanceStore();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ensureOnlineForWrite()) {
      e.target.value = "";
      return;
    }
    setResult("");
    setError("");

    const fd = new FormData();
    fd.append("file", file);
    const res = await apiFetch("/api/import/csv", {
      method: "POST",
      body: fd,
    });
    if (!res) return;
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
    void refresh();
    e.target.value = "";
  }

  return (
    <div>
      <h3 className="font-medium">Импорт CSV</h3>
      <HelpHint className="mt-1">{FEATURE_HINTS.csvImport}</HelpHint>
      <p className="mt-2 text-xs text-muted">
        Колонки: type (asset|income|expense), name, amount, category
      </p>
      <input
        type="file"
        accept=".csv"
        onChange={onFile}
        className="mt-3 text-sm"
      />
      {result && <p className="mt-2 text-sm text-success">{result}</p>}
      <FormError message={error} />
    </div>
  );
}
