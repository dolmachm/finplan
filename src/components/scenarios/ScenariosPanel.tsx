"use client";

import { ScenarioRulesEditor } from "./ScenarioRulesEditor";
import { ScenarioCompare } from "./ScenarioCompare";

export function ScenariosPanel({
  scenarios,
  onRefresh,
  onActivate,
  onUnauthorized,
  compact = false,
}: {
  scenarios: Array<{ id: string; name: string; isActive: boolean; rules: unknown }>;
  onRefresh: () => void;
  onActivate: (id: string) => void;
  onUnauthorized: (res: Response) => boolean;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-3" : "space-y-6"}>
      <section
        className={
          compact
            ? "rounded-lg border border-border bg-card p-3"
            : "rounded-xl border bg-white p-6 shadow-sm"
        }
      >
        <ScenarioRulesEditor
          scenarios={scenarios}
          onSaved={onRefresh}
          onActivate={onActivate}
          compact={compact}
        />
      </section>
      <ScenarioCompare
        scenarios={scenarios}
        onUnauthorized={onUnauthorized}
        compact={compact}
      />
    </div>
  );
}
