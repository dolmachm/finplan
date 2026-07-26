"use client";

import { ScenarioRulesEditor } from "./ScenarioRulesEditor";
import { ScenarioCompare } from "./ScenarioCompare";
import { ScenarioSuggestions } from "./ScenarioSuggestions";

export function ScenariosPanel({
  scenarios,
  onRefresh,
  onActivate,
  compact = false,
}: {
  scenarios: Array<{
    id: string;
    name: string;
    isActive: boolean;
    rules: unknown;
    templateKey?: string | null;
  }>;
  onRefresh: () => void;
  onActivate: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-3" : "space-y-6"}>
      <ScenarioSuggestions
        scenarios={scenarios}
        onRefresh={onRefresh}
        compact={compact}
      />
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
      <ScenarioCompare scenarios={scenarios} compact={compact} />
    </div>
  );
}
