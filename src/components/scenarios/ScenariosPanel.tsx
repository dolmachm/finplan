"use client";

import { ScenarioRulesEditor } from "./ScenarioRulesEditor";
import { ScenarioCompare } from "./ScenarioCompare";

export function ScenariosPanel({
  scenarios,
  onRefresh,
  onActivate,
  onUnauthorized,
}: {
  scenarios: Array<{ id: string; name: string; isActive: boolean; rules: unknown }>;
  onRefresh: () => void;
  onActivate: (id: string) => void;
  onUnauthorized: (res: Response) => boolean;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <ScenarioRulesEditor
          scenarios={scenarios}
          onSaved={onRefresh}
          onActivate={onActivate}
        />
      </section>
      <ScenarioCompare scenarios={scenarios} onUnauthorized={onUnauthorized} />
    </div>
  );
}
