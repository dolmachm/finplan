"use client";

import type { ScenarioRule } from "@/modules/scenarios/rule.types";
import { ConditionEditor, RuleBranchEditor } from "./RuleBranchEditor";

type AssetOption = { id: string; name: string; liquidityDays: number };

interface Props {
  rule: ScenarioRule;
  assets: AssetOption[];
  depth: number;
  onChange: (rule: ScenarioRule) => void;
  onRemove: () => void;
}

export function RuleCard({ rule, assets, depth, onChange, onRemove }: Props) {
  return (
    <div
      className={`rounded-xl border bg-zinc-50/80 p-4 ${depth > 0 ? "border-brand-muted" : "border-zinc-200"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <input
          value={rule.name}
          onChange={(e) => onChange({ ...rule, name: e.target.value })}
          className="font-medium text-sm bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-brand outline-none"
        />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-zinc-600">
            <input
              type="checkbox"
              checked={rule.enabled}
              onChange={(e) => onChange({ ...rule, enabled: e.target.checked })}
            />
            Вкл.
          </label>
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-red-600 hover:underline"
          >
            Удалить
          </button>
        </div>
      </div>

      <ConditionEditor
        condition={rule.condition}
        assets={assets}
        onChange={(condition) => onChange({ ...rule, condition })}
      />

      <div className="mt-4 space-y-3">
        <RuleBranchEditor
          branch={rule.then}
          sideLabel="ТО"
          assets={assets}
          depth={depth}
          onChange={(then) => onChange({ ...rule, then })}
        />
        <RuleBranchEditor
          branch={rule.else ?? { type: "noop", params: {} }}
          sideLabel="ИНАЧЕ"
          assets={assets}
          depth={depth}
          onChange={(elseBranch) => onChange({ ...rule, else: elseBranch })}
        />
      </div>
    </div>
  );
}
