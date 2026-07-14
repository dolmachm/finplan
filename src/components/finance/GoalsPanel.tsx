"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField, HelpHint } from "@/components/ui/FormField";
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
  goalStrategyLabel,
  goalTypeLabel,
} from "@/shared/goals-catalog";
import type { Asset, Goal, GoalStrategy, GoalType } from "@/shared/types";

const selectClass =
  "w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm";

type EditView = { id?: string } | null;

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
  const [editView, setEditView] = useState<EditView>(null);
  const [loading, setLoading] = useState(true);
  const countRef = useRef(onCountChange);
  countRef.current = onCountChange;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [gRes, aRes] = await Promise.all([
        fetch("/api/goals"),
        fetch("/api/assets"),
      ]);
      if (onUnauthorized(gRes) || onUnauthorized(aRes)) return;
      if (gRes.ok) {
        const next: Goal[] = await gRes.json();
        setGoals(next);
        countRef.current?.(next.length);
      }
      if (aRes.ok) setAssets(await aRes.json());
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

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

  if (editView !== null) {
    const existing = editView.id ? goals.find((g) => g.id === editView.id) : undefined;
    return (
      <GoalEditor
        existing={existing}
        assets={assets}
        onBack={() => setEditView(null)}
        onSaved={async () => {
          await load();
          setEditView(null);
        }}
        onUnauthorized={onUnauthorized}
      />
    );
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">Финансовые цели</h3>
          <HelpHint className="mt-1">
            {FEATURE_HINTS.goalsStep} Приоритет 1 — самая важная цель, если денег может не хватить на все сразу.
          </HelpHint>
        </div>
        <Button type="button" variant="secondary" onClick={() => setEditView({})}>
          + Цель
        </Button>
      </div>
      {loading ? (
        <p className="mt-4 text-sm text-muted">Загрузка…</p>
      ) : goals.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Нет целей — добавьте первую</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                {["Приор.", "Название", "Тип", "Сумма", "Срок", "Стратегия", "Частично", ""].map(
                  (h) => (
                    <th key={h} className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {goals.map((g) => (
                <tr key={g.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">{g.priority}</td>
                  <td className="px-3 py-2">{g.name}</td>
                  <td className="px-3 py-2">{goalTypeLabel(g.goalType ?? "OTHER")}</td>
                  <td className="px-3 py-2">{formatRub(g.targetAmountNominal)}</td>
                  <td className="px-3 py-2">{formatGoalDate(g.targetDate)}</td>
                  <td className="px-3 py-2">{goalStrategyLabel(g.strategy ?? "SYSTEMATIC")}</td>
                  <td className="px-3 py-2">{g.allowPartialFunding ? "Да" : "Нет"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Button type="button" variant="ghost" onClick={() => setEditView({ id: g.id })}>
                      Изменить
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => remove(g.id)}>
                      Удалить
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
  const [amount, setAmount] = useState(
    existing ? formatMoneyInput(String(existing.targetAmountNominal)) : "",
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
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) {
      toast.error("Укажите название цели");
      return;
    }
    const amountNum = parsePositiveNumber(amount, "Целевая сумма");
    if (!amountNum.ok || amountNum.value === 0) {
      toast.error(amountNum.ok ? "Сумма должна быть больше нуля" : amountNum.message);
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

    const targetDate = new Date();
    targetDate.setFullYear(targetDate.getFullYear() + yearsNum.value);

    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        goalType,
        targetAmountNominal: amountNum.value,
        targetDate: targetDate.toISOString(),
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
    <Card>
      <button type="button" onClick={onBack} className="text-sm text-brand hover:underline">
        ← К списку целей
      </button>
      <h2 className="mt-2 font-medium">
        {existing ? "Редактирование цели" : "Новая цель"}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField label="Название" htmlFor="goal-name">
          <Input
            id="goal-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Квартира / Пенсия"
          />
        </FormField>
        <FormField label="Тип цели" htmlFor="goal-type" hint="Для чего копите: жильё, подушка, учёба и т.д.">
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
        <FormField label="Целевая сумма, ₽" htmlFor="goal-amount" hint={FIELD_HINTS.goalAmount}>
          <Input
            id="goal-amount"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(formatMoneyInput(e.target.value))}
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
        <FormField label="Стратегия накопления" htmlFor="goal-strategy" hint={FIELD_HINTS.goalStrategy}>
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
        <FormField label="Частичное финансирование" htmlFor="goal-partial" hint="Разрешить копить не всю сумму сразу, если денег не хватает">
          <select
            id="goal-partial"
            className={selectClass}
            value={allowPartialFunding ? "1" : "0"}
            onChange={(e) => setAllowPartialFunding(e.target.value === "1")}
          >
            <option value="1">Да, можно неполную сумму</option>
            <option value="0">Нет — только полная сумма</option>
          </select>
        </FormField>
        <FormField label="Привязанный актив" htmlFor="goal-asset" hint="С какого счёта планируете брать деньги (необязательно)">
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
      <div className="mt-6 flex gap-2">
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
