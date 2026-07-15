"use client";

import { NetWorthChart } from "@/components/charts/NetWorthChart";
import { MonteCarloBandChart } from "@/components/charts/MonteCarloBandChart";
import { InvestmentPlanPanel } from "@/components/finance/InvestmentPlanPanel";
import { ScenariosPanel } from "@/components/scenarios/ScenariosPanel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { FormError } from "@/components/ui/FormError";
import { HelpHint } from "@/components/ui/FormField";
import { PlanInsightsStrip } from "@/components/plan/PlanInsightsStrip";
import { FEATURE_HINTS } from "@/content/help";
import { formatRub } from "@/shared/format";
import type { HomeDashboardInput } from "@/modules/dashboard/insights";

type Projection = {
  result: {
    monthly: Array<{ month: number; netWorth: number; cashflow: number }>;
    summary: {
      finalNetWorth: number;
      avgMonthlySurplus: number;
      recommendedMonthlySaving: number;
    };
  };
  scenario: string;
  isActive: boolean;
};

type SimJob = {
  status: string;
  progressPct: number;
  result?: {
    samplePaths: Array<{ label: string; netWorth: number[] }>;
    goalProbabilities: Array<{
      goalId: string;
      probability: number;
      median: number;
      p5: number;
      p95: number;
    }>;
  };
};

export function PlanWorkspace({
  insightsInput,
  projection,
  projectionLoading,
  viewScenarioId,
  onViewScenarioChange,
  scenarios,
  onActivateScenario,
  onScenariosRefresh,
  simJob,
  simBusy,
  simError,
  onRunSimulation,
  onUnauthorized,
}: {
  insightsInput: HomeDashboardInput | null;
  projection: Projection | null;
  projectionLoading: boolean;
  viewScenarioId: string;
  onViewScenarioChange: (id: string) => void;
  scenarios: Array<{ id: string; name: string; isActive: boolean; rules: unknown }>;
  onActivateScenario: (id: string) => void;
  onScenariosRefresh: () => void;
  simJob: SimJob | null;
  simBusy: boolean;
  simError: string;
  onRunSimulation: () => void;
  onUnauthorized: (res: Response) => boolean;
}) {
  if (!projection) {
    return <p className="text-sm text-muted">Загрузка прогноза…</p>;
  }

  const activeScenario = scenarios.find((s) => s.id === viewScenarioId);

  return (
    <div className="space-y-3">
      <PlanInsightsStrip input={insightsInput} />

      <CollapsibleSection
        title="Обзор и помесячный прогноз"
        subtitle="Базовый расчёт и выбранный сценарий"
        defaultOpen
      >
        <div className="flex flex-wrap items-end justify-between gap-2">
          <label className="flex min-w-[200px] flex-1 items-center gap-2 text-xs sm:text-sm">
            <span className="shrink-0 text-muted">Сценарий:</span>
            <select
              value={viewScenarioId}
              onChange={(e) => onViewScenarioChange(e.target.value)}
              disabled={projectionLoading}
              className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm"
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
          {activeScenario && !activeScenario.isActive && (
            <Button
              type="button"
              variant="secondary"
              className="text-xs"
              onClick={() => onActivateScenario(activeScenario.id)}
            >
              Сделать активным
            </Button>
          )}
        </div>

        <section className="grid gap-2 sm:grid-cols-3">
          <SummaryCard
            title="Взнос / мес"
            value={projection.result.summary.recommendedMonthlySaving}
          />
          <SummaryCard
            title="Профицит / мес"
            value={projection.result.summary.avgMonthlySurplus}
          />
          <SummaryCard
            title="Чистые активы (конец)"
            value={projection.result.summary.finalNetWorth}
          />
        </section>

        <Card className="!p-3 sm:!p-4">
          <h3 className="text-sm font-medium">
            Timeline — {projection.scenario}
            {projection.isActive && (
              <span className="ml-2 text-xs font-normal text-brand">активный</span>
            )}
          </h3>
          {projectionLoading && (
            <p className="mt-1 text-xs text-muted">Пересчёт…</p>
          )}
          <NetWorthChart data={projection.result.monthly} />
        </Card>
      </CollapsibleSection>

      <CollapsibleSection
        title="Monte Carlo"
        subtitle="Вероятности достижения целей (общий расчёт)"
        defaultOpen={false}
      >
        <HelpHint className="text-xs">{FEATURE_HINTS.monteCarlo}</HelpHint>
        <div className="flex flex-wrap items-end gap-2">
          <Button type="button" onClick={onRunSimulation} disabled={simBusy} className="text-xs">
            {simBusy ? "Расчёт…" : "Запустить (5k прогонов)"}
          </Button>
          {simJob && (
            <span className="text-xs text-muted">
              {simJob.status} ({simJob.progressPct}%)
            </span>
          )}
        </div>
        <FormError message={simError} />
        {simJob?.result && (
          <>
            <MonteCarloBandChart paths={simJob.result.samplePaths} />
            <ul className="space-y-1 text-xs">
              {simJob.result.goalProbabilities.map((g) => (
                <li key={g.goalId}>
                  Цель: {(g.probability * 100).toFixed(1)}% · медиана{" "}
                  {formatRub(g.median)} · 5%: {formatRub(g.p5)} · 95%:{" "}
                  {formatRub(g.p95)}
                </li>
              ))}
            </ul>
          </>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Сценарии «что если»"
        subtitle="Правила, шаблоны и сравнение"
        defaultOpen={false}
      >
        <ScenariosPanel
          compact
          scenarios={scenarios}
          onRefresh={onScenariosRefresh}
          onActivate={onActivateScenario}
          onUnauthorized={onUnauthorized}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Инвест-план (годовой)"
        subtitle="Варианты, взносы, цели — без дублирования Monte Carlo"
        defaultOpen={false}
      >
        <InvestmentPlanPanel
          compact
          hideMcChart
          hideHistory
          onUnauthorized={onUnauthorized}
        />
      </CollapsibleSection>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <Card className="!p-3">
      <p className="text-[11px] text-muted">{title}</p>
      <p className="mt-0.5 text-base font-semibold">{formatRub(value)}</p>
    </Card>
  );
}
