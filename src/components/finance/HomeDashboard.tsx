"use client";

/**
 * Home: сразу Score + SummaryGrid из summary API;
 * ниже fold — отложенный mount через IntersectionObserver (без второго fetch).
 * First-run: онбординг; gather/ready — разные CTA.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HelpHint } from "@/components/ui/FormField";
import { OnboardingWelcome } from "@/components/onboarding/OnboardingWelcome";
import type { DashboardTab } from "@/components/layout/DashboardShell";
import {
  buildInsights,
  topActions,
  type DashboardInsight,
  type DashboardMetrics,
  type InsightSeverity,
} from "@/modules/dashboard/insights";
import type { FinancialScore } from "@/modules/dashboard/scoring";
import type { SavingsCorridor } from "@/modules/budget/savings-corridor";
import {
  nextIncompleteStep,
  resolveJourneyPhase,
  useOnboardingDismissed,
  type DataSub,
} from "@/modules/dashboard/journey";
import { formatRub } from "@/shared/format";
import { EnvelopeOverviewCard } from "@/components/finance/EnvelopeOverview";
import { SavingsCorridorCard } from "@/components/finance/SavingsCorridorCard";
import { ScoreCard } from "@/components/finance/ScoreCard";
import type { MonthActualsSnippet } from "@/modules/finance/finance-summary";

const severityClass: Record<InsightSeverity, string> = {
  critical: "border-l-4 border-l-red-500",
  warning: "border-l-4 border-l-amber-500",
  info: "border-l-4 border-l-sky-500",
  positive: "border-l-4 border-l-emerald-600",
};

const severityLabel: Record<InsightSeverity, string> = {
  critical: "Критично",
  warning: "Внимание",
  info: "Совет",
  positive: "Хорошо",
};

export type HomeNavigate = (
  tab: DashboardTab,
  opts?: { dataSub?: DataSub },
) => void;

export function HomeDashboard({
  metrics,
  score,
  corridor = null,
  monthActuals = null,
  loading,
  onNavigate,
}: {
  metrics: DashboardMetrics | null;
  score: FinancialScore | null;
  corridor?: SavingsCorridor | null;
  monthActuals?: MonthActualsSnippet | null;
  loading: boolean;
  onNavigate: HomeNavigate;
}) {
  const [belowFold, setBelowFold] = useState(false);
  const [onboardingDismissed, dismissOnboardingUi] = useOnboardingDismissed();
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || belowFold) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setBelowFold(true);
          obs.disconnect();
        }
      },
      { rootMargin: "120px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [belowFold, metrics]);

  if (loading || !metrics || !score) {
    return <p className="text-muted">Загрузка сводки…</p>;
  }

  // Пустой профиль: ждём клиент, чтобы не мигать gather ↔ welcome.
  if (metrics.completenessPct === 0 && !hydrated) {
    return <p className="text-muted">Загрузка сводки…</p>;
  }

  const phase = resolveJourneyPhase(metrics, onboardingDismissed);

  function finishOnboarding(start: boolean) {
    dismissOnboardingUi();
    if (start) onNavigate("assets", { dataSub: "balance" });
  }

  if (phase === "welcome") {
    return (
      <OnboardingWelcome
        onStart={() => finishOnboarding(true)}
        onSkip={() => finishOnboarding(false)}
      />
    );
  }

  return (
    <div className="space-y-8">
      {phase === "gather" && (
        <GatherBanner metrics={metrics} onNavigate={onNavigate} />
      )}
      {phase === "ready" && (
        <ReadyBanner onNavigate={onNavigate} />
      )}

      <ScoreCard score={score} mode="overall" onNavigate={onNavigate} />
      <SummaryGrid metrics={metrics} />
      {monthActuals && monthActuals.txCount > 0 && (
        <MonthActualsCard data={monthActuals} onNavigate={onNavigate} />
      )}

      <div ref={sentinelRef} aria-hidden className="h-px" />

      {belowFold ? (
        <BelowFold
          metrics={metrics}
          score={score}
          corridor={corridor}
          monthActuals={monthActuals}
          phase={phase}
          onNavigate={onNavigate}
        />
      ) : (
        <p className="text-sm text-muted">Прокрутите ниже за деталями…</p>
      )}
    </div>
  );
}

function GatherBanner({
  metrics,
  onNavigate,
}: {
  metrics: DashboardMetrics;
  onNavigate: HomeNavigate;
}) {
  const next = nextIncompleteStep(metrics);
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 border-brand/25 bg-brand-light/40">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-brand">
          Заполнение · {metrics.completenessPct}%
        </p>
        <p className="mt-1 text-sm font-medium">
          Следующий шаг — {next.label}
        </p>
        <HelpHint className="mt-1">{next.hint}</HelpHint>
      </div>
      <Button
        type="button"
        onClick={() => {
          if (metrics.completenessPct >= 100) onNavigate("plan");
          else onNavigate("assets", { dataSub: next.dataSub });
        }}
      >
        {next.cta}
      </Button>
    </Card>
  );
}

function ReadyBanner({ onNavigate }: { onNavigate: HomeNavigate }) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">Профиль заполнен</p>
        <p className="mt-1 text-sm text-muted">
          Смотрите прогноз и риски — или обновите данные, если что-то изменилось.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => onNavigate("assets", { dataSub: "balance" })}
        >
          К данным
        </Button>
        <Button type="button" onClick={() => onNavigate("plan")}>
          Открыть план
        </Button>
      </div>
    </Card>
  );
}

function BelowFold({
  metrics,
  score,
  corridor,
  monthActuals,
  phase,
  onNavigate,
}: {
  metrics: DashboardMetrics;
  score: FinancialScore;
  corridor: SavingsCorridor | null;
  monthActuals: MonthActualsSnippet | null;
  phase: "gather" | "ready";
  onNavigate: HomeNavigate;
}) {
  const all = buildInsights(metrics, score);
  const actions = topActions(all);
  const insights = all.filter((i) => i.kind === "insight").slice(0, 6);
  const recs = all.filter((i) => i.kind === "recommendation").slice(0, 6);
  const showAdvice = score.status === "ready" || score.status === "stale";

  return (
    <>
      {corridor && (
        <SavingsCorridorCard
          data={corridor}
          monthActuals={monthActuals}
          onNavigate={onNavigate}
        />
      )}
      <EnvelopeOverviewCard
        statuses={metrics.envelopes}
        plannedTotal={metrics.envelopePlannedTotal}
        limitTotal={metrics.envelopeLimitTotal}
        incomeMonthly={metrics.incomeMonthly}
        overspentCount={metrics.envelopeOverspentCount}
        actualExpenseMonth={monthActuals?.expense ?? null}
        onNavigate={onNavigate}
      />
      {phase === "gather" && (
        <StageCard metrics={metrics} onNavigate={onNavigate} />
      )}
      {showAdvice && actions.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-medium">Сделать в первую очередь</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {actions.map((a, idx) => (
              <ActionCard
                key={a.id}
                item={a}
                index={idx + 1}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </section>
      )}
      {showAdvice && (
        <div className="grid gap-6 lg:grid-cols-2">
          <InsightList
            title="Выводы"
            empty="Пока мало данных для выводов."
            items={insights}
            onNavigate={onNavigate}
          />
          <InsightList
            title="Рекомендации"
            empty="Содержательные рекомендации появятся после заполнения профиля."
            items={recs}
            onNavigate={onNavigate}
          />
        </div>
      )}
    </>
  );
}

function MonthActualsCard({
  data,
  onNavigate,
}: {
  data: MonthActualsSnippet;
  onNavigate: HomeNavigate;
}) {
  const label = new Date(data.year, data.month - 1, 1).toLocaleDateString(
    "ru-RU",
    { month: "long", year: "numeric" },
  );
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Факт · {label}
        </p>
        <p className="mt-1 text-sm text-muted">
          {data.txCount}{" "}
          {data.txCount === 1 ? "операция" : "операций"} в этом месяце
        </p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            Доход{" "}
            <strong className="tabular-nums font-semibold text-foreground">
              {formatRub(data.income)}
            </strong>
          </span>
          <span>
            Расход{" "}
            <strong className="tabular-nums font-semibold text-foreground">
              {formatRub(data.expense)}
            </strong>
          </span>
          <span>
            Δ{" "}
            <strong
              className={`tabular-nums font-semibold ${
                data.delta < 0 ? "text-red-600" : "text-foreground"
              }`}
            >
              {formatRub(data.delta)}
            </strong>
          </span>
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={() => onNavigate("assets", { dataSub: "cashflow" })}
      >
        К операциям
      </Button>
    </Card>
  );
}

function SummaryGrid({ metrics: m }: { metrics: DashboardMetrics }) {
  const cells = [
    { label: "Активы", value: formatRub(m.assetsTotal) },
    { label: "Пассивы", value: formatRub(m.liabilitiesTotal) },
    { label: "Чистые активы", value: formatRub(m.netWorth) },
    { label: "Доход / мес", value: formatRub(m.incomeMonthly) },
    { label: "Расход / мес", value: formatRub(m.expenseMonthly) },
    {
      label: "Можно откладывать / мес",
      value: formatRub(m.surplusMonthly),
      hint:
        m.incomeMonthly > 0
          ? `Δ доход−расход · ${(m.savingsRate * 100).toFixed(0)}% дохода`
          : m.recommendedMonthlySaving
            ? `Реком. взнос ${formatRub(m.recommendedMonthlySaving)}`
            : undefined,
    },
  ];
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cells.map((c) => (
        <Card key={c.label} className="p-4">
          <p className="text-xs text-muted">{c.label}</p>
          <p className="mt-1 text-lg font-semibold">{c.value}</p>
          {c.hint && <p className="mt-1 text-[11px] text-muted">{c.hint}</p>}
        </Card>
      ))}
    </section>
  );
}

function StageCard({
  metrics: m,
  onNavigate,
}: {
  metrics: DashboardMetrics;
  onNavigate: HomeNavigate;
}) {
  const next = nextIncompleteStep(m);
  const steps = [
    { done: m.step1, label: "Точка 0", sub: "balance" as const },
    { done: m.step2, label: "Денежный поток", sub: "cashflow" as const },
    { done: m.step3, label: "Цели", sub: "goals" as const },
  ];
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
      <div>
        <p className="text-sm font-medium">
          Этап заполнения · {m.completenessPct}%
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          {steps.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => onNavigate("assets", { dataSub: s.sub })}
              className={
                s.done
                  ? "text-emerald-700 hover:underline"
                  : "text-muted hover:text-foreground hover:underline"
              }
            >
              {s.done ? "✓" : "○"} {s.label}
            </button>
          ))}
        </div>
        <HelpHint className="mt-2">{next.hint}</HelpHint>
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={() => onNavigate("assets", { dataSub: next.dataSub })}
      >
        {next.cta}
      </Button>
    </Card>
  );
}

function ActionCard({
  item,
  index,
  onNavigate,
}: {
  item: DashboardInsight;
  index: number;
  onNavigate: HomeNavigate;
}) {
  return (
    <Card className={`p-4 ${severityClass[item.severity]}`}>
      <p className="text-xs text-muted">
        {index}. {severityLabel[item.severity]}
      </p>
      <p className="mt-1 text-sm font-medium">{item.title}</p>
      <p className="mt-1 text-sm text-muted">{item.body}</p>
      {item.ctaTab && (
        <Button
          type="button"
          className="mt-3"
          variant="secondary"
          onClick={() => onNavigate(item.ctaTab!)}
        >
          {item.ctaLabel ?? "Открыть"}
        </Button>
      )}
    </Card>
  );
}

function InsightList({
  title,
  empty,
  items,
  onNavigate,
}: {
  title: string;
  empty: string;
  items: DashboardInsight[];
  onNavigate: HomeNavigate;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-medium">{title}</h2>
      {items.length === 0 ? (
        <Card className="p-4">
          <p className="text-sm text-muted">{empty}</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <Card className={`p-4 ${severityClass[item.severity]}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted">
                      {severityLabel[item.severity]}
                    </p>
                    <p className="mt-1 text-sm font-medium">{item.title}</p>
                    <p className="mt-1 text-sm text-muted">{item.body}</p>
                  </div>
                  {item.ctaTab && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onNavigate(item.ctaTab!)}
                    >
                      {item.ctaLabel ?? "→"}
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
