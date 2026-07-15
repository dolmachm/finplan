"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScenarioRule } from "@/modules/scenarios/rule.types";
import { createEmptyRule, newRuleId } from "@/modules/scenarios/rule.types";
import { parseRulesFromJson } from "@/modules/scenarios/rule-engine";
import { RULE_TEMPLATES } from "@/modules/scenarios/rule-catalog";
import { toast } from "@/components/ui/ToastProvider";
import { FEATURE_HINTS } from "@/content/help";
import { HelpHint } from "@/components/ui/FormField";
import { readApiError, NETWORK_ERROR_MESSAGE } from "@/shared/api-client";
import type { RuleValidationIssue } from "@/modules/scenarios/rule-validation";
import { RuleCard } from "./RuleCard";

interface ScenarioRow {
  id: string;
  name: string;
  isActive: boolean;
  rules: unknown;
}

type AssetOption = { id: string; name: string; liquidityDays: number };

export function ScenarioRulesEditor({
  scenarios,
  onSaved,
  onActivate,
  compact = false,
}: {
  scenarios: ScenarioRow[];
  onSaved: () => void;
  onActivate: (id: string) => void | Promise<void>;
  compact?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    scenarios[0]?.id ?? null,
  );
  const [rules, setRules] = useState<ScenarioRule[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [issues, setIssues] = useState<RuleValidationIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [activating, setActivating] = useState(false);
  const [dirty, setDirty] = useState(false);

  const selected = scenarios.find((s) => s.id === selectedId);

  const loadAssets = useCallback(async () => {
    const res = await fetch("/api/assets");
    if (res.ok) {
      const data = await res.json();
      setAssets(
        data.map((a: { id: string; name: string; liquidityDays: number }) => ({
          id: a.id,
          name: a.name,
          liquidityDays: a.liquidityDays ?? 0,
        })),
      );
    }
  }, []);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (!selected) return;
    setRules(parseRulesFromJson(selected.rules));
    setDirty(false);
    setIssues([]);
  }, [selectedId, selected?.rules, selected]);

  async function validate() {
    if (!selectedId) return false;
    setValidating(true);
    try {
      const res = await fetch(`/api/scenarios/${selectedId}/validate-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      if (res.ok) {
        const data = await res.json();
        setIssues(data.issues ?? []);
        if (data.valid) {
          toast.success("Правила корректны");
        } else {
          const errors = (data.issues ?? []).filter(
            (i: RuleValidationIssue) => i.level === "error",
          ).length;
          toast.error(
            errors > 0
              ? `Найдено ошибок: ${errors}. Исправьте их и проверьте снова.`
              : "Есть предупреждения в правилах — можно сохранить, но лучше уточнить.",
          );
        }
        return data.valid as boolean;
      }
      const { message, issues } = await readApiError(res);
      if (issues.length) setIssues(issues as unknown as RuleValidationIssue[]);
      toast.error(message);
      return false;
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
      return false;
    } finally {
      setValidating(false);
    }
  }

  async function save() {
    if (!selectedId) return;
    setSaving(true);
    try {
      const valid = await validate();
      if (!valid) return;

      const res = await fetch(`/api/scenarios/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      if (res.ok) {
        setDirty(false);
        onSaved();
        toast.success("Правила сохранены");
      } else {
        const { message, issues } = await readApiError(res);
        if (issues.length) {
          setIssues(issues as unknown as RuleValidationIssue[]);
        } else {
          setIssues([{ ruleId: "", level: "error", message }]);
        }
        toast.error(message);
      }
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setSaving(false);
    }
  }

  function addRule(templateKey?: string) {
    const tpl = RULE_TEMPLATES.find((t) => t.key === templateKey);
    const rule = tpl
      ? { ...tpl.rule, id: newRuleId() }
      : createEmptyRule();
    setRules((r) => [...r, rule]);
    setDirty(true);
  }

  function updateRule(idx: number, updated: ScenarioRule) {
    setRules((r) => r.map((x, i) => (i === idx ? updated : x)));
    setDirty(true);
  }

  function removeRule(idx: number) {
    setRules((r) => r.filter((_, i) => i !== idx));
    setDirty(true);
  }

  return (
    <div className={`grid ${compact ? "gap-3 lg:grid-cols-[180px_1fr]" : "gap-6 lg:grid-cols-[240px_1fr]"}`}>
      <aside className="space-y-2">
        <h3 className="text-sm font-medium text-zinc-700">Сценарии</h3>
        {scenarios.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelectedId(s.id)}
            className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
              selectedId === s.id
                ? "border-brand bg-brand-light"
                : "border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            {s.name}
            {s.isActive && (
              <span className="block text-xs text-brand">активный</span>
            )}
          </button>
        ))}
        <button
          type="button"
          className="w-full rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-left text-xs text-zinc-600 hover:bg-zinc-50"
          onClick={async () => {
            const name = window.prompt("Название сценария", "Новый сценарий");
            if (!name?.trim()) return;
            const res = await fetch("/api/scenarios", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: name.trim(), templateKey: "base" }),
            });
            if (!res.ok) {
              toast.error((await readApiError(res)).message);
              return;
            }
            const row = await res.json();
            toast.success("Сценарий создан");
            onSaved();
            setSelectedId(row.id);
          }}
        >
          + Новый сценарий
        </button>
      </aside>

      <div className={compact ? "space-y-3" : "space-y-4"}>
        {selected && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className={compact ? "text-sm font-medium" : "text-lg font-medium"}>{selected.name}</h2>
                {!compact && (
                  <p className="text-sm text-zinc-500">
                    Если случится условие А — сделайте действие Б (иначе — В). Можно вкладывать ветки.
                  </p>
                )}
                {!compact && <HelpHint>{FEATURE_HINTS.scenarios}</HelpHint>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={activating || saving || validating}
                  onClick={async () => {
                    if (!selected) return;
                    setActivating(true);
                    try {
                      await onActivate(selected.id);
                    } finally {
                      setActivating(false);
                    }
                  }}
                  className="rounded-lg border border-brand px-3 py-1.5 text-sm text-brand hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {activating ? "Применение…" : "Применить сценарий"}
                </button>
                <button
                  type="button"
                  disabled={validating || saving || activating}
                  onClick={() => validate()}
                  className="rounded-lg border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {validating ? "Проверка…" : "Проверить"}
                </button>
                <button
                  type="button"
                  disabled={!dirty || saving || validating || activating}
                  onClick={() => save()}
                  className="rounded-lg bg-brand px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Сохранение…" : "Сохранить правила"}
                </button>
              </div>
            </div>

            {issues.length > 0 && (
              <ul className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm space-y-1">
                {issues.map((iss, i) => (
                  <li
                    key={i}
                    className={
                      iss.level === "error" ? "text-red-700" : "text-amber-800"
                    }
                  >
                    {iss.level === "error" ? "⛔" : "⚠️"} {iss.message}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => addRule()}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs text-white"
              >
                + Правило
              </button>
              {RULE_TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => addRule(t.key)}
                  className="rounded-full border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-50"
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {rules.length === 0 ? (
                <p className="text-sm text-zinc-500 py-8 text-center border rounded-xl border-dashed">
                  Нет правил. Добавьте из шаблона или создайте своё.
                </p>
              ) : (
                rules.map((rule, idx) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    assets={assets}
                    depth={0}
                    onChange={(u) => updateRule(idx, u)}
                    onRemove={() => removeRule(idx)}
                  />
                ))
              )}
            </div>

            {/* Визуальная схема потока */}
            {rules.length > 0 && (
              <FlowPreview rules={rules} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FlowPreview({ rules }: { rules: ScenarioRule[] }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <h3 className="text-sm font-medium text-zinc-700 mb-3">Схема потока</h3>
      <div className="flex flex-col gap-2 font-mono text-xs">
        {rules.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-1">
            <span className={r.enabled ? "text-brand" : "text-zinc-400"}>
              {r.enabled ? "●" : "○"}
            </span>
            <span className="text-amber-700">ЕСЛИ</span>
            <span className="text-zinc-800">{r.condition.type}</span>
            <span className="text-brand">→ ТО</span>
            <BranchLabel branch={r.then} />
            {r.else && (
              <>
                <span className="text-blue-700">→ ИНАЧЕ</span>
                <BranchLabel branch={r.else} />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function BranchLabel({ branch }: { branch: ScenarioRule["then"] }) {
  if (typeof branch === "object" && branch !== null && "type" in branch) {
    if (branch.type === "nested" && "rules" in branch) {
      return (
        <span className="text-purple-700">
          [вложено {branch.rules.length} прав.]
        </span>
      );
    }
    return <span className="text-zinc-600">{branch.type}</span>;
  }
  return null;
}
