"use client";

import { ScenarioRulesEditor } from "./ScenarioRulesEditor";

export function ScenariosPanel({
  scenarios,
  onRefresh,
  onActivate,
}: {
  scenarios: Array<{ id: string; name: string; isActive: boolean; rules: unknown }>;
  onRefresh: () => void;
  onActivate: (id: string) => void;
}) {
  return (
    <section className="rounded-xl border bg-white p-6 shadow-sm">
      <ScenarioRulesEditor
        scenarios={scenarios}
        onSaved={onRefresh}
        onActivate={onActivate}
      />
    </section>
  );
}
