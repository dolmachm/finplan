"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField, HelpHint } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { Modal, ModalFormBox, ModalFormActions } from "@/components/ui/Modal";
import { selectClass } from "@/components/ui/form-controls";
import { toast } from "@/components/ui/ToastProvider";
import { readApiError, parsePositiveNumber } from "@/shared/api-client";
import { apiFetch } from "@/shared/api-fetch";
import { ensureOnlineForWrite } from "@/shared/offline";
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
import { findAchievableSubset } from "@/modules/plan/goal-funding";
import {
  analyzeGoalPaths,
  normalizePathSettings,
  suggestFixesForGoal,
  summarizeGoalsBudget,
  surplusAvailableForGoal,
  type GoalPathKind,
  type GoalPathSettings,
} from "@/modules/plan/goal-paths";
import type { Asset, Goal, GoalStrategy, GoalType } from "@/shared/types";
import type { FinancialScore } from "@/modules/dashboard/scoring";
import { useFinanceStore } from "@/modules/finance/finance-store";
import { ScoreCard } from "@/components/finance/ScoreCard";
import type { PlanProjection } from "@/modules/plan/projection-types";

type EditView = { id?: string } | null;

type StageDraft = {
  id: string;
  label: string;
  amount: string;
  years: string;
};

const ACHIEVE_LABEL: Record<GoalFundingResult["achievability"], string> = {
  max: "С запасом — даже больше цели",
  desired: "Цели хватит к сроку",
  min: "Хватит только на минимум",
  none: "Нет денег на цель",
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
  score = null,
}: {
  score?: FinancialScore | null;
}) {
  const {
    goals,
    assets,
    entitiesLoading: snapshotLoading,
    upsert,
    remove: removeEntity,
    entitiesRevision,
  } = useFinanceStore();
  const [funding, setFunding] = useState<Record<string, GoalFundingResult>>({});
  const [avgSurplus, setAvgSurplus] = useState(0);
  const [editView, setEditView] = useState<EditView>(null);
  const [projectionLoading, setProjectionLoading] = useState(true);

  const loadProjection = useCallback(async () => {
    setProjectionLoading(true);
    try {
      const res = await apiFetch("/api/plan/projection?scenarioId=base");
      if (!res?.ok) return;
      const data = (await res.json()) as PlanProjection;
      const map: Record<string, GoalFundingResult> = {};
      for (const f of data.result?.goalFunding ?? []) {
        map[f.goalId] = f;
      }
      setFunding(map);
      // nearTermSurplus (первые 24 мес) точнее отражает реальный денежный поток
      // для расчёта достижимости целей, чем среднее за весь 30-летний горизонт.
      const s = data.result?.summary;
      setAvgSurplus(s?.nearTermSurplus ?? s?.avgMonthlySurplus ?? 0);
    } finally {
      setProjectionLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjection();
  }, [loadProjection, entitiesRevision]);

  const loading = snapshotLoading || projectionLoading;

  async function remove(id: string) {
    if (!ensureOnlineForWrite()) return;
    const res = await apiFetch(`/api/goals/${id}`, { method: "DELETE" });
    if (!res) return;
    if (!res.ok) {
      toast.error("Не удалось удалить цель");
      return;
    }
    removeEntity("goals", id);
    toast.success("Цель удалена");
    void loadProjection();
  }

  async function savePathSettings(goalId: string, pathSettings: GoalPathSettings) {
    if (!ensureOnlineForWrite()) return;
    const res = await apiFetch(`/api/goals/${goalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pathSettings }),
    });
    if (!res) return;
    if (!res.ok) {
      toast.error((await readApiError(res)).message);
      return;
    }
    const saved = (await res.json()) as Goal;
    upsert("goals", saved);
    toast.success("Вариант достижения сохранён");
  }

  const existing = editView?.id ? goals.find((g) => g.id === editView.id) : undefined;
  const planningScore = score;

  return (
    <div className="space-y-4">
      {planningScore && (
        <ScoreCard score={planningScore} mode="block" blockId="planning" compact />
      )}
      <Card className="!p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-medium">Финансовые цели</h3>
            <HelpHint className="mt-1">
              {FEATURE_HINTS.goalsStep} Для каждой цели можно выбрать: копить
              полностью, взять кредит или сначала накопить часть суммы, а потом
              взять кредит. Приоритет 1 финансируется первым.
            </HelpHint>
          </div>
          <Button type="button" variant="secondary" onClick={() => setEditView({})}>
            + Цель
          </Button>
        </div>
      </Card>

      {editView !== null && (
        <Modal
          open
          title={existing ? "Редактировать цель" : "Добавить цель"}
          onClose={() => setEditView(null)}
        >
          <GoalEditor
            existing={existing}
            assets={assets}
            onBack={() => setEditView(null)}
            onSaved={async () => {
              setEditView(null);
              void loadProjection();
            }}
          />
        </Modal>
      )}

      {loading ? (
        <p className="text-sm text-muted">Загрузка…</p>
      ) : goals.length === 0 ? (
        <Card className="!p-4">
          <p className="text-sm text-muted">Нет целей — добавьте первую</p>
        </Card>
      ) : (
        <>
          <GoalsBudgetBanner
            goals={goals}
            funding={funding}
            avgSurplus={avgSurplus}
          />
          <div className="grid gap-3 md:grid-cols-2">
            {goals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                goals={goals}
                funding={funding[g.id]}
                fundingMap={funding}
                avgSurplus={avgSurplus}
                onEdit={() => setEditView({ id: g.id })}
                onDelete={() => remove(g.id)}
                onSavePaths={(ps) => savePathSettings(g.id, ps)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function GoalsBudgetBanner({
  goals,
  funding,
  avgSurplus,
}: {
  goals: Goal[];
  funding: Record<string, GoalFundingResult>;
  avgSurplus: number;
}) {
  // Суммируем взносы только по достижимым целям — недостижимые не занимают бюджет.
  const achievableGoals = goals.filter(
    (g) => funding[g.id] && funding[g.id]!.achievability !== "none",
  );
  let remaining = avgSurplus;
  const analyses = achievableGoals.map((g) => {
    const a = analyzeGoalPaths({
      targetAmount: g.targetAmountNominal,
      monthsToGoal: funding[g.id]?.monthsToGoal ?? 12,
      avgMonthlySurplus: remaining,
      funding: funding[g.id],
      settings: g.pathSettings,
    });
    remaining = Math.max(0, remaining - a.budget.requiredMonthly);
    return a;
  });
  const summary = summarizeGoalsBudget(analyses, avgSurplus);
  const inMinus = !summary.budgetOk;
  const unachievableCount = goals.length - achievableGoals.length;

  // When plan is in deficit, find which goals are still achievable
  const allNone =
    inMinus &&
    Object.values(funding).length > 0 &&
    Object.values(funding).every((f) => f.achievability === "none");

  const achievableIds = allNone
    ? findAchievableSubset(Object.values(funding), Math.max(0, avgSurplus))
    : [];

  const achievableNames =
    achievableIds.length > 0
      ? achievableIds
          .map((id) => goals.find((g) => g.id === id)?.name ?? "")
          .filter(Boolean)
      : [];

  return (
    <Card
      className={
        inMinus
          ? "!p-3 border-red-300 bg-red-50"
          : " !p-3 border-emerald-200 bg-emerald-50/50"
      }
    >
      <p className={`text-xs font-medium uppercase tracking-wide ${inMinus ? "text-red-700" : "text-muted"}`}>
        {inMinus ? "План в минусе" : "Бюджет и цели"}
      </p>
      <p className={`mt-1 text-sm ${inMinus ? "font-medium text-red-800" : ""}`}>
        {summary.advice}
      </p>
      <p className={`mt-1 text-xs ${inMinus ? "text-red-700" : "text-muted"}`}>
        Взносы на достижимые цели: {formatRub(summary.requiredMonthly)}/мес · профицит:{" "}
        {formatRub(avgSurplus)}/мес · остаток:{" "}
        <span className={inMinus ? "font-semibold" : ""}>
          {formatRub(summary.remainingMonthly)}/мес
        </span>
        {unachievableCount > 0 && (
          <span className="ml-1 text-amber-700">· {unachievableCount} {unachievableCount === 1 ? "цель" : unachievableCount < 5 ? "цели" : "целей"} вне бюджета</span>
        )}
      </p>
      {achievableNames.length > 0 && (
        <p className="mt-2 text-xs text-amber-800 border-t border-red-200 pt-2">
          <span className="font-medium">Если сосредоточиться на главных:</span>{" "}
          {achievableNames.length === goals.length
            ? "все цели достижимы по отдельности"
            : `по приоритету и бюджету реально закрыть — ${achievableNames.join(", ")}.`}{" "}
          Сократите расходы или скорректируйте цели, чтобы уложиться.
        </p>
      )}
      {allNone && achievableNames.length === 0 && (
        <p className="mt-2 text-xs text-red-700 border-t border-red-200 pt-2">
          При текущем бюджете ни одна цель недостижима. Необходимо увеличить
          доходы или снизить расходы.
        </p>
      )}
    </Card>
  );
}

function GoalFixConstructor({
  goal,
  funding,
  availableSurplus,
  draft,
  onApplyFix,
}: {
  goal: Goal;
  funding?: GoalFundingResult;
  availableSurplus: number;
  draft: GoalPathSettings;
  onApplyFix: (fix: ReturnType<typeof suggestFixesForGoal>[number]) => void;
}) {
  const fixes = suggestFixesForGoal({
    targetAmount: goal.targetAmountNominal,
    monthsToGoal: funding?.monthsToGoal ?? 12,
    avgMonthlySurplus: availableSurplus,
    funding,
    settings: draft,
    goalPriority: goal.priority,
  });

  if (fixes.length === 0) return null;

  return (
    <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/60 px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-red-700">
        Как достичь цели
      </p>
      <ul className="space-y-1.5">
        {fixes.map((fix) => (
          <li key={fix.kind + fix.label} className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground">{fix.label}</p>
              <p className="text-[11px] text-muted">{fix.hint}</p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-md border border-red-300 bg-white px-2 py-0.5 text-[11px] text-red-700 hover:bg-red-50"
              onClick={() => onApplyFix(fix)}
            >
              {fix.kind === "switch_path" ? "Применить" : "Изменить"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GoalCard({
  goal,
  goals,
  funding,
  fundingMap,
  avgSurplus,
  onEdit,
  onDelete,
  onSavePaths,
}: {
  goal: Goal;
  goals: Goal[];
  funding?: GoalFundingResult;
  fundingMap: Record<string, GoalFundingResult>;
  avgSurplus: number;
  onEdit: () => void;
  onDelete: () => void;
  onSavePaths: (ps: GoalPathSettings) => void | Promise<void>;
}) {
  const stages = goal.stages ?? [];
  const monthsToGoal = funding?.monthsToGoal ?? 12;
  const [draft, setDraft] = useState(() =>
    normalizePathSettings(goal.pathSettings, monthsToGoal),
  );
  const [savingPaths, setSavingPaths] = useState(false);

  useEffect(() => {
    setDraft(normalizePathSettings(goal.pathSettings, monthsToGoal));
  }, [goal.pathSettings, goal.id, monthsToGoal]);

  // availableSurplus — профицит после взносов на более приоритетные ДОСТИЖИМЫЕ цели.
  // Недостижимые цели исключены из цепочки до момента выбора варианта пользователем.
  const availableSurplus = surplusAvailableForGoal(
    goal.id,
    goals,
    fundingMap,
    avgSurplus,
  );

  const achieve = funding?.achievability;
  const isAchievable = achieve && achieve !== "none";

  // availableSurplus — реальный профицит этой цели (после достижимых с бóльшим приоритетом).
  // Недостижимые цели в цепочке не участвуют.
  // Для недостижимых целей тоже используем availableSurplus — он рассчитан корректно.
  const analysis = analyzeGoalPaths({
    targetAmount: goal.targetAmountNominal,
    monthsToGoal,
    avgMonthlySurplus: availableSurplus,
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
    <Card className={`!p-4 space-y-3 ${achieve === "none" ? "border-red-300" : achieve === "min" ? "border-amber-300" : ""}`}>
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

        {(() => {
          const isCapital = analysis.selectedKind === "CAPITAL" &&
            analysis.options.find((o) => o.kind === "CAPITAL")?.feasible;
          const occupiedByOthers = Math.max(0, avgSurplus - availableSurplus);
          const required = analysis.budget.requiredMonthly;
          const remaining = availableSurplus - required;
          const budgetOk = analysis.budget.budgetOk;
          return (
            <div
              className={
                budgetOk
                  ? "rounded-lg border border-emerald-200 bg-emerald-50/80 px-2.5 py-2 text-xs"
                  : "rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-2 text-xs"
              }
            >
              <p className="font-medium">{analysis.budget.contributionAdvice}</p>
              {!isCapital && (
                <p className="mt-0.5 text-muted">
                  Свободно {formatRub(availableSurplus)}/мес
                  {occupiedByOthers > 1 && (
                    <span className="text-muted"> (из {formatRub(avgSurplus)}/мес профицита, {formatRub(occupiedByOthers)} занято другими целями)</span>
                  )}
                  {" → "}на путь {formatRub(required)}/мес → остаток{" "}
                  <span className={remaining >= -1 ? "text-emerald-700" : "text-amber-800"}>
                    {formatRub(remaining)}/мес
                  </span>
                </p>
              )}
              <p className="mt-0.5">{analysis.budget.budgetAdvice}</p>
            </div>
          );
        })()}

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
                  <span className={
                    o.kind === "CAPITAL"
                      ? o.feasible ? "text-emerald-700" : "text-muted"
                      : o.feasible
                        ? availableSurplus >= o.monthlyOutflow - 1 ? "" : "text-amber-700"
                        : "text-red-600"
                  }>
                    {o.kind === "CAPITAL" && o.feasible
                      ? "покрыто капиталом"
                      : `${formatRub(o.monthlyOutflow)}/мес`}
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
          <FormField
            label="Срок кр., мес"
            htmlFor={`term-${goal.id}`}
            hint={!draft.loanTermCustom ? `из цели: ${monthsToGoal}` : undefined}
          >
            <Input
              id={`term-${goal.id}`}
              inputMode="numeric"
              className="!py-1.5 text-xs"
              value={String(draft.loanTermMonths)}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  loanTermMonths: Number(e.target.value.replace(/\D/g, "")) || 1,
                  loanTermCustom: true,
                }))
              }
              onBlur={() => persist({ ...draft, loanTermCustom: true })}
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
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="text-[11px] text-muted underline hover:text-foreground"
            disabled={savingPaths}
            onClick={() =>
              persist({ ...draft, preferredKind: null })
            }
          >
            Сбросить выбор → рекомендация
          </button>
          {draft.loanTermCustom && (
            <button
              type="button"
              className="text-[11px] text-muted underline hover:text-foreground"
              disabled={savingPaths}
              onClick={() =>
                persist({
                  ...draft,
                  loanTermCustom: false,
                  loanTermMonths: monthsToGoal,
                })
              }
            >
              Срок кредита = срок цели ({monthsToGoal} мес.)
            </button>
          )}
        </div>
      </div>

      {achieve === "none" && (
        <GoalFixConstructor
          goal={goal}
          funding={funding}
          availableSurplus={availableSurplus}
          draft={draft}
          onApplyFix={(fix) => {
            if (fix.kind === "switch_path" && typeof fix.value === "string") {
              void persist({ ...draft, preferredKind: fix.value as GoalPathKind });
            } else if (fix.kind === "extend_term" || fix.kind === "reduce_amount") {
              onEdit();
            } else {
              onEdit();
            }
          }}
        />
      )}

      {achieve !== "none" && funding && funding.requiredMonthlyDesired > funding.allocatedMonthlySaving + 1 && (
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
}: {
  existing?: Goal;
  assets: Asset[];
  onBack: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { upsert } = useFinanceStore();
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
  const stagesSumDisplay = stages.reduce((s, st) => {
    const n = Number(String(st.amount).replace(/\s/g, "").replace(",", "."));
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);

  function updateStage(id: string, patch: Partial<StageDraft>) {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function save() {
    if (!ensureOnlineForWrite()) return;
    if (!name.trim()) {
      toast.error("Укажите название цели");
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

    const stagesSum = parsedStages.reduce((s, st) => s + st.amount, 0);
    let desiredValue = 0;
    if (parsedStages.length > 0) {
      desiredValue = stagesSum;
    } else {
      const desiredNum = parsePositiveNumber(desired, "Желаемая сумма");
      if (!desiredNum.ok || desiredNum.value === 0) {
        toast.error(
          desiredNum.ok ? "Сумма должна быть больше нуля" : desiredNum.message,
        );
        return;
      }
      desiredValue = desiredNum.value;
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
    if (minVal != null && minVal > desiredValue) {
      toast.error("Минимум не может быть больше желаемой суммы");
      return;
    }
    if (maxVal != null && maxVal < desiredValue) {
      toast.error("Максимум не может быть меньше желаемой суммы");
      return;
    }

    const yearsNum = parsePositiveNumber(years, "Срок");
    if (parsedStages.length === 0 && (!yearsNum.ok || yearsNum.value === 0)) {
      toast.error("Укажите срок в годах");
      return;
    }
    const priorityNum = Number(priority);
    if (!Number.isInteger(priorityNum) || priorityNum < 1) {
      toast.error("Приоритет: целое число от 1");
      return;
    }

    const targetDate = new Date();
    if (parsedStages.length > 0) {
      const last = parsedStages.reduce((a, b) =>
        a.targetDate > b.targetDate ? a : b,
      );
      targetDate.setTime(new Date(last.targetDate).getTime());
    } else if (yearsNum.ok) {
      targetDate.setFullYear(targetDate.getFullYear() + yearsNum.value);
    }

    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        goalType,
        targetAmountNominal: desiredValue,
        targetDate: targetDate.toISOString(),
        minAmount: minVal,
        maxAmount: maxVal,
        stages: parsedStages,
        priority: priorityNum,
        allowPartialFunding,
        strategy,
        linkedAssetId: linkedAssetId || null,
      };
      const res = await apiFetch(
        existing ? `/api/goals/${existing.id}` : "/api/goals",
        {
          method: existing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res) return;
      if (!res.ok) {
        const { message } = await readApiError(res);
        toast.error(message);
        return;
      }
      upsert("goals", (await res.json()) as Goal);
      toast.success(existing ? "Цель обновлена" : "Цель добавлена");
      await onSaved();
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <ModalFormBox>
      <div className="grid gap-3 sm:grid-cols-2">
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
        <FormField
          label="Желаемая сумма, ₽"
          htmlFor="goal-desired"
          hint={
            stages.length > 0
              ? "Сумма считается по этапам — отдельно вводить не нужно."
              : FIELD_HINTS.goalAmount
          }
        >
          <Input
            id="goal-desired"
            inputMode="numeric"
            value={
              stages.length > 0
                ? formatMoneyInput(String(Math.round(stagesSumDisplay)))
                : desired
            }
            onChange={(e) => setDesired(formatMoneyInput(e.target.value))}
            placeholder="6 000 000"
            disabled={stages.length > 0}
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
    </ModalFormBox>
    <ModalFormActions
      onCancel={onBack}
      onSubmit={save}
      submitting={saving}
      submitLabel={existing ? "Сохранить" : "Добавить"}
    />
    </>
  );
}
