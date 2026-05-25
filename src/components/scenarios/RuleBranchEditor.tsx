"use client";

import type { RuleBranch, RuleAction, ScenarioRule } from "@/modules/scenarios/rule.types";
import { isNestedBranch, newRuleId, createEmptyRule } from "@/modules/scenarios/rule.types";
import {
  ACTION_CATALOG,
  CONDITION_CATALOG,
  getActionEntry,
  getConditionEntry,
  type CatalogField,
} from "@/modules/scenarios/rule-catalog";
import { RuleCard } from "./RuleCard";

type AssetOption = { id: string; name: string; liquidityDays: number };

interface Props {
  branch: RuleBranch;
  sideLabel: string;
  assets: AssetOption[];
  depth: number;
  onChange: (branch: RuleBranch) => void;
}

export function RuleBranchEditor({
  branch,
  sideLabel,
  assets,
  depth,
  onChange,
}: Props) {
  const isNested = isNestedBranch(branch);

  if (isNested) {
    return (
      <div className="ml-4 border-l-2 border-emerald-200 pl-4 space-y-3">
        <p className="text-xs font-medium text-emerald-800">
          {sideLabel} → вложенные правила
        </p>
        {branch.rules.map((nested, idx) => (
          <RuleCard
            key={nested.id}
            rule={nested}
            assets={assets}
            depth={depth + 1}
            onChange={(updated) => {
              const rules = [...branch.rules];
              rules[idx] = updated;
              onChange({ type: "nested", rules });
            }}
            onRemove={() => {
              onChange({
                type: "nested",
                rules: branch.rules.filter((_, i) => i !== idx),
              });
            }}
          />
        ))}
        <button
          type="button"
          className="text-xs text-emerald-700 underline"
          onClick={() =>
            onChange({
              type: "nested",
              rules: [...branch.rules, createEmptyRule("Вложенное правило")],
            })
          }
        >
          + Добавить вложенное IF
        </button>
        <button
          type="button"
          className="ml-4 text-xs text-zinc-500 underline"
          onClick={() => onChange({ type: "noop", params: {} })}
        >
          Убрать вложение (→ одно действие)
        </button>
      </div>
    );
  }

  const action = branch as RuleAction;
  const entry = getActionEntry(action.type);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">
          {sideLabel}
        </span>
        <select
          value={action.type}
          onChange={(e) => {
            const t = e.target.value;
            const def = getActionEntry(t);
            const params: Record<string, unknown> = {};
            def?.fields.forEach((f) => {
              if (f.default !== undefined) params[f.key] = f.default;
            });
            if (t === "nested") {
              onChange({ type: "nested", rules: [createEmptyRule()] });
            } else {
              onChange({ type: t, params });
            }
          }}
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
        >
          {ACTION_CATALOG.map((a) => (
            <option key={a.type} value={a.type}>
              {a.label}
            </option>
          ))}
          <option value="nested">↳ Вложенный IF/ELSE</option>
        </select>
        {entry && (
          <span className="text-xs text-zinc-500">{entry.description}</span>
        )}
      </div>
      {entry && entry.fields.length > 0 && (
        <ParamFields
          fields={entry.fields}
          params={action.params ?? {}}
          assets={assets}
          onChange={(params) => onChange({ ...action, params })}
        />
      )}
    </div>
  );
}

export function ConditionEditor({
  condition,
  assets,
  onChange,
}: {
  condition: ScenarioRule["condition"];
  assets: AssetOption[];
  onChange: (c: ScenarioRule["condition"]) => void;
}) {
  const entry = getConditionEntry(condition.type);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
          IF
        </span>
        <select
          value={condition.type}
          onChange={(e) => {
            const t = e.target.value;
            const def = getConditionEntry(t);
            const params: Record<string, unknown> = {};
            def?.fields.forEach((f) => {
              if (f.default !== undefined) params[f.key] = f.default;
            });
            onChange({ type: t, params });
          }}
          className="rounded border border-zinc-300 px-2 py-1 text-sm min-w-[200px]"
        >
          {CONDITION_CATALOG.map((c) => (
            <option key={c.type} value={c.type}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      {entry && (
        <p className="text-xs text-zinc-500 pl-1">{entry.description}</p>
      )}
      {entry && entry.fields.length > 0 && (
        <ParamFields
          fields={entry.fields}
          params={condition.params ?? {}}
          assets={assets}
          onChange={(params) => onChange({ ...condition, params })}
        />
      )}
    </div>
  );
}

function ParamFields({
  fields,
  params,
  assets,
  onChange,
}: {
  fields: CatalogField[];
  params: Record<string, unknown>;
  assets: AssetOption[];
  onChange: (p: Record<string, unknown>) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 pl-1">
      {fields.map((f) => (
        <label key={f.key} className="flex flex-col gap-1 text-xs">
          <span className="text-zinc-600">{f.label}</span>
          {f.type === "asset" ? (
            <select
              value={String(params[f.key] ?? "")}
              onChange={(e) => onChange({ ...params, [f.key]: e.target.value })}
              className="rounded border px-2 py-1.5 text-sm"
            >
              <option value="">— выберите —</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} (ликв. {a.liquidityDays} дн.)
                </option>
              ))}
            </select>
          ) : f.type === "select" ? (
            <select
              value={String(params[f.key] ?? f.default ?? "")}
              onChange={(e) => onChange({ ...params, [f.key]: e.target.value })}
              className="rounded border px-2 py-1.5 text-sm"
            >
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              value={Number(params[f.key] ?? f.default ?? 0)}
              min={f.min}
              max={f.max}
              onChange={(e) =>
                onChange({ ...params, [f.key]: Number(e.target.value) })
              }
              className="rounded border px-2 py-1.5 text-sm"
            />
          )}
        </label>
      ))}
    </div>
  );
}
