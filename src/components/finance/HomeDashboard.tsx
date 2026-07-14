"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HelpHint } from "@/components/ui/FormField";
import type { DashboardTab } from "@/components/layout/DashboardShell";
import {
  buildInsights,
  computeDashboardMetrics,
  topActions,
  type DashboardInsight,
  type DashboardMetrics,
  type HomeDashboardInput,
  type InsightSeverity,
} from "@/modules/dashboard/insights";
import { formatRub } from "@/shared/format";

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

export function HomeDashboard({
  input,
  loading,
  onNavigate,
}: {
  input: HomeDashboardInput | null;
  loading: boolean;
  onNavigate: (tab: DashboardTab) => void;
}) {
  if (loading || !input) {
    return <p className="text-muted">Загрузка сводки…</p>;
  }

  const metrics = computeDashboardMetrics(input);
  const all = buildInsights(metrics);
  const actions = topActions(all);
  const insights = all.filter((i) => i.kind === "insight").slice(0, 6);
  const recs = all.filter((i) => i.kind === "recommendation").slice(0, 6);

  return (
    <div className="space-y-8">
      <SummaryGrid metrics={metrics} />
      <StageCard metrics={metrics} onNavigate={onNavigate} />
      {actions.length > 0 && (
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
      <div className="grid gap-6 lg:grid-cols-2">
        <InsightList
          title="Инсайты"
          empty="Пока мало данных для инсайтов — заполните «Данные»."
          items={insights}
          onNavigate={onNavigate}
        />
        <InsightList
          title="Рекомендации"
          empty="Рекомендации появятся после ввода баланса и cashflow."
          items={recs}
          onNavigate={onNavigate}
        />
      </div>
    </div>
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
      label: "Профицит / мес",
      value: formatRub(m.surplusMonthly),
      hint: m.recommendedMonthlySaving
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
  onNavigate: (tab: DashboardTab) => void;
}) {
  const steps = [
    { done: m.step1, label: "Точка 0" },
    { done: m.step2, label: "Денежный поток" },
    { done: m.step3, label: "Цели" },
  ];
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
      <div>
        <p className="text-sm font-medium">
          Этап заполнения · {m.completenessPct}%
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          {steps.map((s) => (
            <span
              key={s.label}
              className={s.done ? "text-emerald-700" : "text-muted"}
            >
              {s.done ? "✓" : "○"} {s.label}
            </span>
          ))}
        </div>
        <HelpHint className="mt-2">
          {!m.step1
            ? "Начните с активов и пассивов на вкладке «Данные»."
            : !m.step2
              ? "Добавьте доходы и расходы."
              : !m.step3
                ? "Задайте цели и макропараметры."
                : "Профиль готов — смотрите план и риски."}
        </HelpHint>
      </div>
      <Button type="button" variant="secondary" onClick={() => onNavigate("assets")}>
        {m.completenessPct < 100 ? "Продолжить ввод" : "К данным"}
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
  onNavigate: (tab: DashboardTab) => void;
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
  onNavigate: (tab: DashboardTab) => void;
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
