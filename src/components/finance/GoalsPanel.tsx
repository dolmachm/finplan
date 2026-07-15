"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField, HelpHint } from "@/components/ui/FormField";
import { FormPanelHeader } from "@/components/ui/FormPanelHeader";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/ToastProvider";
import { readApiError, parsePositiveNumber } from "@/shared/api-client";
import { formatMoneyInput } from "@/shared/format-input";
import { formatRub } from "@/shared/format";
import { FIELD_HINTS, FEATURE_HINTS } from "@/content/help";
import {
  formatGoalDate,
  GOAL_STRATEGY_OPTIONS,
  GOAL_TYPE_OPTIONS,
  goalTypeLabel,
} from "@/shared/goals-catalog";
import type { GoalFundingResult } from "@/modules/plan/types";
import {
  analyzeGoalPaths,
  normalizePathSettings,
  type GoalPathSettings,
} from "@/modules/plan/goal-paths";
import type { Asset, Goal, GoalStrategy, GoalType } from "@/shared/types";

const selectClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm";

type EditView = { id?: string } | null;

type StageDraft = {
  id: string;
  label: string;
  amount: string;
  years: string;
};

const ACHIEVE_LABEL: Record<GoalFundingResult["achievability"], string> = {
  max: "Максимум достижим",
  desired: "Желаемая достижима",
  min: "Только минимум",
  none: "Недостижима при текущем плане",
};

const ACHIEVE_CLASS: Record<GoalFundingResult["achievability"], string> = {
  max: "text-emerald-700",
  desired: "text-emerald-700",
  min: "text-amber-700",
  none: "text-red-600",
};

function newStageId() {
  return `st_${Math.random().toString(36).slice(2, 10)}`;
}

export function GoalsPanel({
  onSaved,
  onUnauthorized,
  onCountChange,
}: {
  onSaved?: () => void;
  onUnauthorized: (res: Response) => boolean;
  onCountChange?: (count: number) => void;
}) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [funding, setFunding] = useState<Record<string, GoalFundingResult>>({});
  const [avgSurplus, setAvgSurplus] = useState(0);
  const [editView, setEditView] = useState<EditView>(null);
  const [loading, setLoading] = useState(true);
  const editorRef = useRef<HTMLDivElement>(null);
  const countRef = useRef(onCountChange);
  countRef.current = onCountChange;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [gRes, aRes, pRes] = await Promise.all([
        fetch("/api/goals"),
        fetch("/api/assets"),
        fetch("/api/plan/projection?scenarioId=base", { cache: "no-store" }),
      ]);
      if (onUnauthorized(gRes) || onUnauthorized(aRes)) return;
      if (gRes.ok) {
        const next: Goal[] = await gRes.json();
        setGoals(next);
        countRef.current?.(next.length);
      }
      if (aRes.ok) setAssets(await aRes.json());
      if (pRes.ok) {
        const data = await pRes.json();
        const map: Record<string, GoalFundingResult> = {};
        for (const f of (data.result?.goalFunding ?? []) as GoalFundingResult[]) {
          map[f.goalId] = f;
        }
        setFunding(map);
        setAvgSurplus(data.result?.summary?.avgMonthlySurplus ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (editView !== null && editorRef.current) {
      editorRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [editView]);

  async function remove(id: string) {
    const res = await fetch(`/api/goals/${id}`, { method: "DELETE" });
    if (onUnauthorized(res)) return;
    if (!res.ok) {
      toast.error("Не удалось удалить цель");
      return;
    }
    toast.success("Цель удалена");
    await load();
    onSaved?.();
  }

  async function savePathSettings(goalId: string, pathSettings: GoalPathSettings) {
    const res = await fetch(`/api/goals/${goalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pathSettings }),
    });
    if (onUnauthorized(res)) return;
    if (!res.ok) {
      toast.error((await readApiError(res)).message);
      return;
    }
    setGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, pathSettings } : g)),
    );
    toast.success("Вариант достижения сохранён");
  }

  const existing = editView?.id ? goals.find((g) => g.id === editView.id) : undefined;

  return (
    <div className="space-y-4">
      <Card className="!p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-medium">Финансовые цели</h3>
            <HelpHint className="mt-1">
              {FEATURE_HINTS.goalsStep} Приоритет 1 финансируется первым; взносы и
              достижимость считаются с учётом профицита и других целей.
            </HelpHint>
          </div>
          <Button type="button" variant="secondary" onClick={() => setEditView({})}>
            + Цель
          </Button>
        </div>
      </Card>

      {editView !== null && (
        <div ref={editorRef} className="scroll-mt-4">
          <GoalEditor
            existing={existing}
            assets={assets}
            onBack={() => setEditView(null)}
            onSaved={async () => {
              await load();
              setEditView(null);
              onSaved?.();
            }}
            onUnauthorized={onUnauthorized}
          />
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted">Загрузка…</p>
      ) : goals.length === 0 ? (
        <Card className="!p-4">
          <p className="text-sm text-muted">Нет целей — добавьте первую</p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {goals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              funding={funding[g.id]}
              avgSurplus={avgSurplus}
              onEdit={() => setEditView({ id: g.id })}
              onDelete={() => remove(g.id)}
              onSavePaths={(ps) => savePathSettings(g.id, ps)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GoalCard({
  goal,
  funding,
  avgSurplus,
  onEdit,
  onDelete,
  onSavePaths,
}: {
  goal: Goal;
  funding?: GoalFundingResult;
  avgSurplus: number;
  onEdit: () => void;
  onDelete: () => void;
  onSavePaths: (ps: GoalPathSettings) => void | Promise<void>;
}) {
  const stages = goal.stages ?? [];
  const achieve = funding?.achievability;
  const [draft, setDraft] = useState(() =>
    normalizePathSettings(goal.pathSettings),
  );
  const [savingPaths, setSavingPaths] = useState(false);

  useEffect(() => {
    setDraft(normalizePathSettings(goal.pathSettings));
  }, [goal.pathSettings, goal.id]);

  const analysis = analyzeGoalPaths({
    targetAmount: goal.targetAmountNominal,
    monthsToGoal: funding?.monthsToGoal ?? 12,
    avgMonthlySurplus: avgSurplus,
    funding,
    settings: draft,
  });

  async function persist(next: GoalPathSettings) {
    setDraft(next);
    setSavingPaths(true);
    try {
      await onSavePaths(next);
    } finally {
      setSavingPaths(false);
    }
  }

  return (
    <Card className="!p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted">
            Приоритет {goal.priority} · {goalTypeLabel(goal.goalType ?? "OTHER")}
          </p>
          <h4 className="font-medium">{goal.name}</h4>
        </div>
        {achieve && (
          <span className={`text-xs font-medium ${ACHIEVE_CLASS[achieve]}`}>
            {ACHIEVE_LABEL[achieve]}
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
        <div>
          <dt className="text-[11px] text-muted">Желаемая</dt>
          <dd className="font-medium">{formatRub(goal.targetAmountNominal)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted">Срок</dt>
          <dd>{formatGoalDate(goal.targetDate)}</dd>
        </div>
        {(goal.minAmount != null || goal.maxAmount != null) && (
          <>
            <div>
              <dt className="text-[11px] text-muted">Минимум</dt>
              <dd>{goal.minAmount != null ? formatRub(goal.minAmount) : "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted">Максимум</dt>
              <dd>{goal.maxAmount != null ? formatRub(goal.maxAmount) : "—"}</dd>
            </div>
          </>
        )}
        {funding && (
          <>
            <div>
              <dt className="text-[11px] text-muted">Взнос / мес (нужно)</dt>
              <dd className="font-medium">
                {formatRub(funding.requiredMonthlyDesired)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted">Из профицита плана</dt>
              <dd>{formatRub(funding.allocatedMonthlySaving)}</dd>
            </div>
          </>
        )}
      </dl>

      {stages.length > 0 && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Этапы ({stages.length})
          </p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {stages.map((s) => (
              <li key={s.id} className="flex justify-between gap-2">
                <span className="truncate text-muted">
                  {s.label} · {formatGoalDate(s.targetDate)}
                </span>
                <span>{formatRub(s.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Способы достижения
          </p>
          <span className="text-[11px] text-brand">
            Лучший:{" "}
            {analysis.options.find((o) => o.kind === analysis.recommendedKind)?.label}
          </span>
        </div>
        <div className="grid gap-1.5">
          {analysis.options.map((o) => {
            const selected = analysis.selectedKind === o.kind;
            const recommended = analysis.recommendedKind === o.kind;
            return (
              <button
                key={o.kind}
                type="button"
                disabled={savingPaths}
                onClick={() =>
                  persist({
                    ...draft,
                    preferredKind: o.kind,
                  })
                }
                className={
                  selected
                    ? "rounded-lg border border-brand bg-brand/5 px-2.5 py-2 text-left"
                    : "rounded-lg border border-border px-2.5 py-2 text-left hover:bg-muted/30"
                }
              >
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">
                    {o.label}
                    {recommended && (
                      <span className="ml-1 text-[10px] font-normal text-brand">
                        рек.
                      </span>
                    )}
                  </span>
                  <span className={o.feasible ? "" : "text-red-600"}>
                    {formatRub(o.monthlyOutflow)}/мес
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted">
                  Итого ≈ {formatRub(o.totalCost)}
                  {o.months > 0 ? ` · ${o.months} мес.` : ""} · {o.note}
                </p>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <FormField label="Ставка, %" htmlFor={`rate-${goal.id}`}>
            <Input
              id={`rate-${goal.id}`}
              inputMode="decimal"
              className="!py-1.5 text-xs"
              value={String(draft.loanRatePct)}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  loanRatePct: Number(e.target.value.replace(",", ".")) || 0,
                }))
              }
              onBlur={() => persist(draft)}
            />
          </FormField>
          <FormField label="Срок кр., мес" htmlFor={`term-${goal.id}`}>
            <Input
              id={`term-${goal.id}`}
              inputMode="numeric"
              className="!py-1.5 text-xs"
              value={String(draft.loanTermMonths)}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  loanTermMonths: Number(e.target.value.replace(/\D/g, "")) || 1,
                }))
              }
              onBlur={() => persist(draft)}
            />
          </FormField>
          <FormField label="Взнос, %" htmlFor={`down-${goal.id}`}>
            <Input
              id={`down-${goal.id}`}
              inputMode="numeric"
              className="!py-1.5 text-xs"
              value={String(draft.downPaymentPct)}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  downPaymentPct: Number(e.target.value.replace(/\D/g, "")) || 0,
                }))
              }
              onBlur={() => persist(draft)}
            />
          </FormField>
        </div>
        <button
          type="button"
          className="text-[11px] text-muted underline hover:text-foreground"
          disabled={savingPaths}
          onClick={() =>
            persist({ ...draft, preferredKind: null })
          }
        >
          Сбросить выбор → следовать рекомендации
        </button>
      </div>

      {funding && funding.requiredMonthlyDesired > funding.allocatedMonthlySaving + 1 && (
        <p className="text-xs text-amber-700">
          Не хватает ≈{" "}
          {formatRub(funding.requiredMonthlyDesired - funding.allocatedMonthlySaving)}
          /мес при текущем приоритете и прочих целях.
        </p>
      )}

      <div className="flex gap-2 border-t border-border pt-3">
        <Button type="button" variant="secondary" className="flex-1" onClick={onEdit}>
          Изменить
        </Button>
        <Button type="button" variant="ghost" className="flex-1" onClick={onDelete}>
          Удалить
        </Button>
      </div>
    </Card>
  );
}

function GoalEditor({
  existing,
  assets,
  onBack,
  onSaved,
  onUnauthorized,
}: {
  existing?: Goal;
  assets: Asset[];
  onBack: () => void;
  onSaved: () => void | Promise<void>;
  onUnauthorized: (res: Response) => boolean;
}) {
  const existingDate = existing?.targetDate ? new Date(existing.targetDate) : null;
  const defaultYears = existingDate
    ? String(Math.max(1, existingDate.getFullYear() - new Date().getFullYear()))
    : "7";

  const [name, setName] = useState(existing?.name ?? "");
  const [goalType, setGoalType] = useState<GoalType>(existing?.goalType ?? "HOME");
  const [desired, setDesired] = useState(
    existing ? formatMoneyInput(String(existing.targetAmountNominal)) : "",
  );
  const [minAmount, setMinAmount] = useState(
    existing?.minAmount != null ? formatMoneyInput(String(existing.minAmount)) : "",
  );
  const [maxAmount, setMaxAmount] = useState(
    existing?.maxAmount != null ? formatMoneyInput(String(existing.maxAmount)) : "",
  );
  const [years, setYears] = useState(defaultYears);
  const [priority, setPriority] = useState(String(existing?.priority ?? 1));
  const [allowPartialFunding, setAllowPartialFunding] = useState(
    existing?.allowPartialFunding ?? true,
  );
  const [strategy, setStrategy] = useState<GoalStrategy>(
    existing?.strategy ?? "SYSTEMATIC",
  );
  const [linkedAssetId, setLinkedAssetId] = useState(existing?.linkedAssetId ?? "");
  const [stages, setStages] = useState<StageDraft[]>(() => {
    const list = existing?.stages ?? [];
    if (!list.length) return [];
    const nowY = new Date().getFullYear();
    return list.map((s) => ({
      id: s.id,
      label: s.label,
      amount: formatMoneyInput(String(s.amount)),
      years: String(Math.max(1, new Date(s.targetDate).getFullYear() - nowY)),
    }));
  });
  const [saving, setSaving] = useState(false);

  function updateStage(id: string, patch: Partial<StageDraft>) {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Укажите название цели");
      return;
    }
    const desiredNum = parsePositiveNumber(desired, "Желаемая сумма");
    if (!desiredNum.ok || desiredNum.value === 0) {
      toast.error(desiredNum.ok ? "Сумма должна быть больше нуля" : desiredNum.message);
      return;
    }

    let minVal: number | null = null;
    if (minAmount.trim()) {
      const m = parsePositiveNumber(minAmount, "Минимум");
      if (!m.ok || m.value === 0) {
        toast.error(m.ok ? "Минимум должен быть > 0" : m.message);
        return;
      }
      minVal = m.value;
    }
    let maxVal: number | null = null;
    if (maxAmount.trim()) {
      const m = parsePositiveNumber(maxAmount, "Максимум");
      if (!m.ok || m.value === 0) {
        toast.error(m.ok ? "Максимум должен быть > 0" : m.message);
        return;
      }
      maxVal = m.value;
    }
    if (minVal != null && minVal > desiredNum.value) {
      toast.error("Минимум не может быть больше желаемой суммы");
      return;
    }
    if (maxVal != null && maxVal < desiredNum.value) {
      toast.error("Максимум не может быть меньше желаемой суммы");
      return;
    }

    const yearsNum = parsePositiveNumber(years, "Срок");
    if (!yearsNum.ok || yearsNum.value === 0) {
      toast.error("Укажите срок в годах");
      return;
    }
    const priorityNum = Number(priority);
    if (!Number.isInteger(priorityNum) || priorityNum < 1) {
      toast.error("Приоритет: целое число от 1");
      return;
    }

    const parsedStages: Array<{
      id: string;
      label: string;
      amount: number;
      targetDate: string;
    }> = [];
    for (const st of stages) {
      if (!st.label.trim()) {
        toast.error("У каждого этапа должно быть название");
        return;
      }
      const amt = parsePositiveNumber(st.amount, `Этап «${st.label}»`);
      if (!amt.ok || amt.value === 0) {
        toast.error(amt.ok ? "Сумма этапа > 0" : amt.message);
        return;
      }
      const y = parsePositiveNumber(st.years, `Срок этапа «${st.label}»`);
      if (!y.ok || y.value === 0) {
        toast.error("Укажите срок этапа в годах");
        return;
      }
      const d = new Date();
      d.setFullYear(d.getFullYear() + y.value);
      parsedStages.push({
        id: st.id,
        label: st.label.trim(),
        amount: amt.value,
        targetDate: d.toISOString(),
      });
    }

    const targetDate = new Date();
    if (parsedStages.length > 0) {
      const last = parsedStages.reduce((a, b) =>
        a.targetDate > b.targetDate ? a : b,
      );
      targetDate.setTime(new Date(last.targetDate).getTime());
    } else {
      targetDate.setFullYear(targetDate.getFullYear() + yearsNum.value);
    }

    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        goalType,
        targetAmountNominal: desiredNum.value,
        targetDate: targetDate.toISOString(),
        minAmount: minVal,
        maxAmount: maxVal,
        stages: parsedStages,
        priority: priorityNum,
        allowPartialFunding,
        strategy,
        linkedAssetId: linkedAssetId || null,
      };
      const res = await fetch(
        existing ? `/api/goals/${existing.id}` : "/api/goals",
        {
          method: existing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (onUnauthorized(res)) return;
      if (!res.ok) {
        const { message } = await readApiError(res);
        toast.error(message);
        return;
      }
      toast.success(existing ? "Цель обновлена" : "Цель добавлена");
      await onSaved();
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-accent/20 bg-accent-light/30 !p-4">
      <FormPanelHeader
        title={existing ? "Редактирование цели" : "Новая цель"}
        onCancel={onBack}
      />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <FormField label="Название" htmlFor="goal-name">
          <Input
            id="goal-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Квартира / Пенсия"
          />
        </FormField>
        <FormField label="Тип цели" htmlFor="goal-type">
          <select
            id="goal-type"
            className={selectClass}
            value={goalType}
            onChange={(e) => setGoalType(e.target.value as GoalType)}
          >
            {GOAL_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Желаемая сумма, ₽" htmlFor="goal-desired" hint={FIELD_HINTS.goalAmount}>
          <Input
            id="goal-desired"
            inputMode="numeric"
            value={desired}
            onChange={(e) => setDesired(formatMoneyInput(e.target.value))}
            placeholder="6 000 000"
          />
        </FormField>
        <FormField label="Срок, лет" htmlFor="goal-years" hint={FIELD_HINTS.goalYears}>
          <Input
            id="goal-years"
            inputMode="numeric"
            value={years}
            onChange={(e) => setYears(e.target.value.replace(/\D/g, "").slice(0, 2))}
            placeholder="7"
            disabled={stages.length > 0}
          />
        </FormField>
        <FormField label="Минимум, ₽" htmlFor="goal-min" hint="Нижняя планка: «хоть столько»">
          <Input
            id="goal-min"
            inputMode="numeric"
            value={minAmount}
            onChange={(e) => setMinAmount(formatMoneyInput(e.target.value))}
            placeholder="необязательно"
          />
        </FormField>
        <FormField label="Максимум, ₽" htmlFor="goal-max" hint="Верхняя планка накоплений">
          <Input
            id="goal-max"
            inputMode="numeric"
            value={maxAmount}
            onChange={(e) => setMaxAmount(formatMoneyInput(e.target.value))}
            placeholder="необязательно"
          />
        </FormField>
        <FormField label="Приоритет" htmlFor="goal-priority" hint={FIELD_HINTS.goalPriority}>
          <Input
            id="goal-priority"
            inputMode="numeric"
            value={priority}
            onChange={(e) => setPriority(e.target.value.replace(/\D/g, "").slice(0, 2))}
            placeholder="1"
          />
        </FormField>
        <FormField label="Стратегия" htmlFor="goal-strategy" hint={FIELD_HINTS.goalStrategy}>
          <select
            id="goal-strategy"
            className={selectClass}
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as GoalStrategy)}
          >
            {GOAL_STRATEGY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Этапы выплат</p>
          <Button
            type="button"
            variant="secondary"
            className="text-xs"
            disabled={stages.length >= 12}
            onClick={() =>
              setStages((prev) => [
                ...prev,
                {
                  id: newStageId(),
                  label: `Этап ${prev.length + 1}`,
                  amount: "",
                  years: years || "5",
                },
              ])
            }
          >
            + Этап
          </Button>
        </div>
        <HelpHint>
          Несколько сумм в разные годы (например, взносы за обучение). Без этапов —
          одна выплата к сроку выше.
        </HelpHint>
        {stages.map((st) => (
          <div
            key={st.id}
            className="grid gap-2 rounded-lg border border-border bg-card p-2 sm:grid-cols-[1fr_1fr_5rem_auto]"
          >
            <Input
              value={st.label}
              onChange={(e) => updateStage(st.id, { label: e.target.value })}
              placeholder="Название этапа"
            />
            <Input
              inputMode="numeric"
              value={st.amount}
              onChange={(e) =>
                updateStage(st.id, { amount: formatMoneyInput(e.target.value) })
              }
              placeholder="Сумма"
            />
            <Input
              inputMode="numeric"
              value={st.years}
              onChange={(e) =>
                updateStage(st.id, {
                  years: e.target.value.replace(/\D/g, "").slice(0, 2),
                })
              }
              placeholder="Лет"
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStages((prev) => prev.filter((x) => x.id !== st.id))}
            >
              ×
            </Button>
          </div>
        ))}
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-muted hover:text-foreground">
          Ещё настройки
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FormField label="Частичное финансирование" htmlFor="goal-partial">
            <select
              id="goal-partial"
              className={selectClass}
              value={allowPartialFunding ? "1" : "0"}
              onChange={(e) => setAllowPartialFunding(e.target.value === "1")}
            >
              <option value="1">Да</option>
              <option value="0">Нет — только полная сумма</option>
            </select>
          </FormField>
          <FormField label="Привязанный актив" htmlFor="goal-asset">
            <select
              id="goal-asset"
              className={selectClass}
              value={linkedAssetId}
              onChange={(e) => setLinkedAssetId(e.target.value)}
            >
              <option value="">— Не привязан —</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </details>

      <div className="mt-4 flex gap-2">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "Сохранение…" : "Сохранить"}
        </Button>
        <Button type="button" variant="secondary" onClick={onBack}>
          Отмена
        </Button>
      </div>
    </Card>
  );
}
