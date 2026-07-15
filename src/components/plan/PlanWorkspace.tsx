"use client";

import { NetWorthChart } from "@/components/charts/NetWorthChart";
import { MonteCarloBandChart } from "@/components/charts/MonteCarloBandChart";
import { InvestmentPlanPanel } from "@/components/finance/InvestmentPlanPanel";
import { ScenariosPanel } from "@/components/scenarios/ScenariosPanel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormError } from "@/components/ui/FormError";
import { HelpHint } from "@/components/ui/FormField";
import { PlanInsightsStrip } from "@/components/plan/PlanInsightsStrip";
import { selectClass } from "@/components/ui/form-controls";
import { FEATURE_HINTS } from "@/content/help";
import { formatRub } from "@/shared/format";
import type { HomeDashboardInput } from "@/modules/dashboard/insights";

export type PlanSection = "overview" | "montecarlo" | "iplan" | "scenarios";

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
  section = "overview",
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
  section?: PlanSection;
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
    <div className="space-y-4">
      {section === "overview" && (
        <>
          <PlanInsightsStrip input={insightsInput} />

          <div className="flex flex-wrap items-end justify-between gap-2">
            <label className="flex min-w-[200px] flex-1 items-center gap-2 text-xs sm:text-sm">
              <span className="shrink-0 text-muted">Сценарий:</span>
              <select
                value={viewScenarioId}
                onChange={(e) => onViewScenarioChange(e.target.value)}
                disabled={projectionLoading}
                className={selectClass}
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

          <section className="grid gap-3 sm:grid-cols-3">
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

          <Card>
            <h3 className="text-sm font-medium">
              Timeline — {projection.scenario}
              {projection.isActive && (
                <span className="ml-2 text-xs font-normal text-accent">активный</span>
              )}
            </h3>
            {projectionLoading && (
              <p className="mt-1 text-xs text-muted">Пересчёт…</p>
            )}
            <NetWorthChart data={projection.result.monthly} />
          </Card>
        </>
      )}

      {section === "montecarlo" && (
        <Card className="space-y-4">
          <div>
            <h2 className="font-medium">Monte Carlo</h2>
            <HelpHint className="mt-1">{FEATURE_HINTS.monteCarlo}</HelpHint>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button type="button" onClick={onRunSimulation} disabled={simBusy}>
              {simBusy ? "Расчёт…" : "Запустить (5k прогонов)"}
            </Button>
            {simJob && (
              <span className="text-sm text-muted">
                {simJob.status} ({simJob.progressPct}%)
              </span>
            )}
          </div>
          <FormError message={simError} />
          {simJob?.result && (
            <>
              <MonteCarloBandChart paths={simJob.result.samplePaths} />
              <ul className="space-y-1 text-sm">
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
        </Card>
      )}

      {section === "scenarios" && (
        <ScenariosPanel
          compact
          scenarios={scenarios}
          onRefresh={onScenariosRefresh}
          onActivate={onActivateScenario}
          onUnauthorized={onUnauthorized}
        />
      )}

      {section === "iplan" && (
        <InvestmentPlanPanel
          compact
          hideMcChart
          hideHistory
          onUnauthorized={onUnauthorized}
        />
      )}
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <Card className="bg-brand-light/40">
      <p className="text-xs text-muted">{title}</p>
      <p className="mt-1 text-lg font-semibold">{formatRub(value)}</p>
    </Card>
  );
}
