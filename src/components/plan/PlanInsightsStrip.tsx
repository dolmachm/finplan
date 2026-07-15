"use client";

import { Card } from "@/components/ui/card";
import {
  buildInsights,
  computeDashboardMetrics,
  topActions,
  type DashboardInsight,
  type HomeDashboardInput,
  type InsightSeverity,
} from "@/modules/dashboard/insights";

const severityClass: Record<InsightSeverity, string> = {
  critical: "border-l-4 border-l-red-500",
  warning: "border-l-4 border-l-amber-500",
  info: "border-l-4 border-l-sky-500",
  positive: "border-l-4 border-l-emerald-600",
};

function InsightChip({ item }: { item: DashboardInsight }) {
  return (
    <Card className={`p-3 ${severityClass[item.severity]}`}>
      <p className="text-xs font-medium">{item.title}</p>
      <p className="mt-0.5 text-xs text-muted">{item.body}</p>
    </Card>
  );
}

export function PlanInsightsStrip({
  input,
}: {
  input: HomeDashboardInput | null;
}) {
  if (!input) return null;

  const metrics = computeDashboardMetrics(input);
  const all = buildInsights(metrics);
  const actions = topActions(all).slice(0, 2);
  const insights = all.filter((i) => i.kind === "insight").slice(0, 3);
  const recs = all.filter((i) => i.kind === "recommendation").slice(0, 3);

  if (actions.length === 0 && insights.length === 0 && recs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {actions.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {actions.map((a, i) => (
            <InsightChip key={a.id} item={{ ...a, title: `${i + 1}. ${a.title}` }} />
          ))}
        </div>
      )}
      <div className="grid gap-2 lg:grid-cols-2">
        {insights.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Выводы
            </p>
            {insights.map((item) => (
              <InsightChip key={item.id} item={item} />
            ))}
          </div>
        )}
        {recs.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Рекомендации
            </p>
            {recs.map((item) => (
              <InsightChip key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
