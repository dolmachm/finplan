"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField, HelpHint } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { Modal, ModalFormBox, ModalFormActions } from "@/components/ui/Modal";
import { selectClass } from "@/components/ui/form-controls";
import { toast } from "@/components/ui/ToastProvider";
import { CategoryCatalogPicker } from "@/components/finance/CategoryCatalogPicker";
import { EnvelopeBars } from "@/components/finance/EnvelopeOverview";
import {
  buildBudgetSummary,
  envelopeMonthStatuses,
} from "@/modules/budget/budget-summary";
import { useFinanceStore } from "@/modules/finance/finance-store";
import { readApiError, parsePositiveNumber } from "@/shared/api-client";
import { apiFetch } from "@/shared/api-fetch";
import { formatMoneyInput } from "@/shared/format-input";
import { formatRub } from "@/shared/format";
import { ensureOnlineForWrite } from "@/shared/offline";
import type {
  BudgetCategory,
  CashTransaction,
  Expense,
  Income,
} from "@/shared/types";

type BudgetTab = "summary" | "categories" | "operations";

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
}

function toInputDate(d: Date | string) {
  const x = d instanceof Date ? d : new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function applyPlanLists(
  upsert: (key: "incomes" | "expenses", row: Income | Expense) => void,
  removeEntity: (key: "incomes" | "expenses", id: string) => void,
  prevIncomes: Income[],
  prevExpenses: Expense[],
  nextIncomes: Income[],
  nextExpenses: Expense[],
) {
  for (const i of nextIncomes) upsert("incomes", i);
  const keepInc = new Set(nextIncomes.map((i) => i.id));
  for (const i of prevIncomes) {
    if (!keepInc.has(i.id)) removeEntity("incomes", i.id);
  }
  for (const e of nextExpenses) upsert("expenses", e);
  const keepExp = new Set(nextExpenses.map((e) => e.id));
  for (const e of prevExpenses) {
    if (!keepExp.has(e.id)) removeEntity("expenses", e.id);
  }
}

export function BudgetWorkspace({
  categories,
  expenses,
  incomes,
}: {
  categories: BudgetCategory[];
  expenses: Expense[];
  incomes: Income[];
}) {
  const { upsert, remove: removeEntity, assets, liabilities } = useFinanceStore();
  const now = new Date();
  const [tab, setTab] = useState<BudgetTab>("summary");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [txs, setTxs] = useState<CashTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [limitDrafts, setLimitDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [incomeDraft, setIncomeDraft] = useState("");
  const [expenseDraft, setExpenseDraft] = useState("");
  const [txOpen, setTxOpen] = useState(false);
  const [txEditId, setTxEditId] = useState<string | null>(null);
  const [txKind, setTxKind] = useState<"income" | "expense">("expense");
  const [txName, setTxName] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txCategory, setTxCategory] = useState("general");
  const [txDate, setTxDate] = useState(toInputDate(now));
  const [barsMode, setBarsMode] = useState<"plan" | "actual">("actual");

  const loadTxs = useCallback(async () => {
    setTxLoading(true);
    try {
      const res = await apiFetch(
        `/api/transactions?year=${year}&month=${month}`,
      );
      if (!res) return;
      if (!res.ok) {
        toast.error((await readApiError(res)).message);
        return;
      }
      setTxs((await res.json()) as CashTransaction[]);
    } finally {
      setTxLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void loadTxs();
  }, [loadTxs]);

  const summary = useMemo(
    () =>
      buildBudgetSummary({
        incomes,
        expenses,
        assets,
        liabilities,
        budgetCategories: categories,
        monthTxs: txs,
      }),
    [incomes, expenses, assets, liabilities, categories, txs],
  );

  const statuses = useMemo(
    () => envelopeMonthStatuses(expenses, categories, txs),
    [expenses, categories, txs],
  );

  useEffect(() => {
    setIncomeDraft(formatMoneyInput(String(Math.round(summary.incomeMonthly))));
    setExpenseDraft(
      formatMoneyInput(String(Math.round(summary.expenseMonthly))),
    );
  }, [summary.incomeMonthly, summary.expenseMonthly]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const c of categories) {
      if (c.kind !== "expense") continue;
      next[c.id] =
        c.monthlyLimit == null ? "" : formatMoneyInput(String(c.monthlyLimit));
    }
    setLimitDrafts(next);
  }, [categories]);

  const expenseCats = categories.filter((c) => c.kind === "expense");
  const incomeCats = categories.filter((c) => c.kind === "income");

  function shiftMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  }

  function openNewTx() {
    setTxEditId(null);
    setTxKind("expense");
    setTxName("");
    setTxAmount("");
    setTxCategory(expenseCats[0]?.id ?? "general");
    setTxDate(
      toInputDate(new Date(year, month - 1, Math.min(now.getDate(), 28))),
    );
    setTxOpen(true);
  }

  function openEditTx(t: CashTransaction) {
    setTxEditId(t.id);
    setTxKind(t.kind);
    setTxName(t.name);
    setTxAmount(formatMoneyInput(String(t.amount)));
    setTxCategory(t.category || "general");
    setTxDate(toInputDate(t.date));
    setTxOpen(true);
  }

  async function saveSummary() {
    if (!ensureOnlineForWrite()) return;
    const inc = parsePositiveNumber(incomeDraft, "Доход");
    const exp = parsePositiveNumber(expenseDraft, "Расход");
    const incomeMonthly = incomeDraft.trim()
      ? Number(incomeDraft.replace(/\s/g, ""))
      : NaN;
    const expenseMonthly = expenseDraft.trim()
      ? Number(expenseDraft.replace(/\s/g, ""))
      : NaN;
    if (!Number.isFinite(incomeMonthly) || incomeMonthly < 0) {
      toast.error(inc.ok ? "Некорректный доход" : inc.message);
      return;
    }
    if (!Number.isFinite(expenseMonthly) || expenseMonthly < 0) {
      toast.error(exp.ok ? "Некорректный расход" : exp.message);
      return;
    }
    setBusyId("summary");
    try {
      const res = await apiFetch("/api/budget/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incomeMonthly, expenseMonthly }),
      });
      if (!res) return;
      if (!res.ok) {
        toast.error((await readApiError(res)).message);
        return;
      }
      const json = (await res.json()) as {
        incomes: Income[];
        expenses: Expense[];
      };
      applyPlanLists(
        upsert,
        removeEntity,
        incomes,
        expenses,
        json.incomes,
        json.expenses,
      );
      toast.success("Сводка записана в план");
    } catch {
      toast.error("Не удалось сохранить сводку");
    } finally {
      setBusyId(null);
    }
  }

  async function syncFromActuals() {
    if (!ensureOnlineForWrite()) return;
    setBusyId("sync");
    try {
      const res = await apiFetch("/api/budget/sync-from-actuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ months: 3 }),
      });
      if (!res) return;
      if (!res.ok) {
        toast.error((await readApiError(res)).message);
        return;
      }
      const json = (await res.json()) as {
        incomes: Income[];
        expenses: Expense[];
      };
      applyPlanLists(
        upsert,
        removeEntity,
        incomes,
        expenses,
        json.incomes,
        json.expenses,
      );
      toast.success("План обновлён по среднему факту за 3 мес.");
    } catch {
      toast.error("Не удалось обновить план");
    } finally {
      setBusyId(null);
    }
  }

  async function structurePlan(
    action: "collapse" | "expand",
    kind: "income" | "expense",
  ) {
    if (!ensureOnlineForWrite()) return;
    const key = `${action}-${kind}`;
    setBusyId(key);
    try {
      const res = await apiFetch("/api/budget/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, kind }),
      });
      if (!res) return;
      if (!res.ok) {
        toast.error((await readApiError(res)).message);
        return;
      }
      const json = (await res.json()) as {
        incomes: Income[];
        expenses: Expense[];
      };
      applyPlanLists(
        upsert,
        removeEntity,
        incomes,
        expenses,
        json.incomes,
        json.expenses,
      );
      toast.success(
        action === "collapse"
          ? kind === "expense"
            ? "Расходы свёрнуты в одну строку"
            : "Доходы свёрнуты в одну строку"
          : kind === "expense"
            ? "Расходы разбиты по категориям"
            : "Доходы разбиты по категориям",
      );
    } catch {
      toast.error("Не удалось изменить структуру");
    } finally {
      setBusyId(null);
    }
  }

  async function saveLimit(id: string) {
    if (!ensureOnlineForWrite()) return;
    const raw = limitDrafts[id] ?? "";
    let monthlyLimit: number | null = null;
    if (raw.trim()) {
      const n = Number(raw.replace(/\s/g, ""));
      if (!Number.isFinite(n) || n < 0) {
        toast.error("Лимит: введите число ≥ 0");
        return;
      }
      monthlyLimit = n;
    }
    setBusyId(id);
    try {
      const res = await apiFetch(`/api/budget-categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyLimit }),
      });
      if (!res) return;
      if (!res.ok) {
        toast.error((await readApiError(res)).message);
        return;
      }
      upsert("budgetCategories", (await res.json()) as BudgetCategory);
      toast.success("Лимит сохранён");
    } catch {
      toast.error("Не удалось сохранить лимит");
    } finally {
      setBusyId(null);
    }
  }

  async function removeCategory(id: string) {
    if (!ensureOnlineForWrite()) return;
    setBusyId(id);
    try {
      const res = await apiFetch(`/api/budget-categories/${id}`, {
        method: "DELETE",
      });
      if (!res) return;
      if (!res.ok) {
        toast.error("Не удалось удалить");
        return;
      }
      removeEntity("budgetCategories", id);
      toast.success("Категория удалена");
    } catch {
      toast.error("Не удалось удалить");
    } finally {
      setBusyId(null);
    }
  }

  async function saveTx() {
    if (!ensureOnlineForWrite()) return;
    if (!txName.trim()) {
      toast.error("Укажите название");
      return;
    }
    const amountNum = parsePositiveNumber(txAmount, "Сумма");
    if (!amountNum.ok) {
      toast.error(amountNum.message);
      return;
    }
    setBusyId("tx");
    try {
      const body = {
        kind: txKind,
        name: txName.trim(),
        amount: amountNum.value,
        category: txCategory,
        date: txDate,
      };
      const res = await apiFetch(
        txEditId ? `/api/transactions/${txEditId}` : "/api/transactions",
        {
          method: txEditId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res) return;
      if (!res.ok) {
        toast.error((await readApiError(res)).message);
        return;
      }
      setTxOpen(false);
      setTxEditId(null);
      setTxName("");
      setTxAmount("");
      toast.success(txEditId ? "Операция обновлена" : "Операция добавлена");
      await loadTxs();
    } catch {
      toast.error("Не удалось сохранить");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteTx(id: string) {
    if (!ensureOnlineForWrite()) return;
    setBusyId(id);
    try {
      const res = await apiFetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (!res) return;
      if (!res.ok) {
        toast.error("Не удалось удалить");
        return;
      }
      setTxs((prev) => prev.filter((t) => t.id !== id));
      toast.success("Удалено");
    } catch {
      toast.error("Не удалось удалить");
    } finally {
      setBusyId(null);
    }
  }

  const overspentCount = statuses.filter(
    (s) => s.overspentActual || s.overspent,
  ).length;
  const hasUnallocated =
    summary.unallocatedExpenseMonthly > 0.01 ||
    summary.unallocatedIncomeMonthly > 0.01;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Бюджет
          </p>
          <h3 className="mt-1 font-medium">План и факт в одних цифрах</h3>
          <HelpHint className="mt-1">
            Сводка и категории — шаблоны плана. Операции — факт месяца и
            контроль лимитов. В прогноз и iPlan идут только шаблоны.
          </HelpHint>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["summary", "Сводка"],
              ["categories", "Категории"],
              ["operations", "Операции"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              type="button"
              variant={tab === id ? "primary" : "secondary"}
              onClick={() => setTab(id)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Доход план / мес"
          value={formatRub(summary.incomeMonthly)}
        />
        <Metric
          label="Расход план / мес"
          value={formatRub(summary.expenseMonthly)}
        />
        <Metric
          label="Δ / профицит плана"
          value={formatRub(summary.surplusMonthly)}
          danger={summary.surplusMonthly < 0}
        />
        <Metric
          label="После лимитов"
          value={formatRub(summary.afterEnvelopesMonthly)}
          danger={summary.afterEnvelopesMonthly < 0}
          hint={
            summary.limitTotal > 0
              ? `floor ${formatRub(summary.floorMonthly)}`
              : undefined
          }
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Metric
          label={`Факт доход · ${monthLabel(year, month)}`}
          value={formatRub(summary.actualIncomeMonth)}
        />
        <Metric
          label={`Факт расход · ${monthLabel(year, month)}`}
          value={formatRub(summary.actualExpenseMonth)}
        />
        <Metric
          label="Факт Δ"
          value={formatRub(summary.actualDeltaMonth)}
          danger={summary.actualDeltaMonth < 0}
        />
      </div>

      {hasUnallocated && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-sm">
          <p className="font-medium text-amber-900">Неразнесённое</p>
          <p className="mt-1 text-amber-800/90">
            Сводка минус суммы по категориям (без «general»).
          </p>
          <ul className="mt-2 space-y-1 tabular-nums text-amber-950">
            {summary.unallocatedExpenseMonthly > 0.01 && (
              <li>
                Расходы: {formatRub(summary.unallocatedExpenseMonthly)}
                <span className="text-amber-800/80">
                  {" "}
                  (в категориях {formatRub(summary.categorizedExpenseMonthly)})
                </span>
              </li>
            )}
            {summary.unallocatedIncomeMonthly > 0.01 && (
              <li>
                Доходы: {formatRub(summary.unallocatedIncomeMonthly)}
                <span className="text-amber-800/80">
                  {" "}
                  (в категориях {formatRub(summary.categorizedIncomeMonthly)})
                </span>
              </li>
            )}
          </ul>
        </div>
      )}

      {tab === "summary" && (
        <div className="mt-6 space-y-4 border-t border-border pt-4">
          <p className="text-sm font-medium">Верхнеуровневый ввод</p>
          <HelpHint>
            Меняет те же шаблоны плана: одна строка — обновление суммы; несколько —
            пропорциональное масштабирование.
          </HelpHint>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Доход, ₽/мес" htmlFor="sum-inc">
              <Input
                id="sum-inc"
                inputMode="numeric"
                value={incomeDraft}
                onChange={(e) => setIncomeDraft(formatMoneyInput(e.target.value))}
              />
            </FormField>
            <FormField label="Расход, ₽/мес" htmlFor="sum-exp">
              <Input
                id="sum-exp"
                inputMode="numeric"
                value={expenseDraft}
                onChange={(e) =>
                  setExpenseDraft(formatMoneyInput(e.target.value))
                }
              />
            </FormField>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busyId === "summary"}
              onClick={() => void saveSummary()}
            >
              {busyId === "summary" ? "…" : "Записать в план"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busyId === "sync"}
              onClick={() => void syncFromActuals()}
            >
              {busyId === "sync" ? "…" : "Обновить план из факта (3 мес.)"}
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-sm font-medium">Структура плана</p>
            <HelpHint className="mt-1">
              Свернуть — одна сводная строка. Разбить — по вашим категориям
              (пропорционально лимитам, иначе поровну).
            </HelpHint>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={busyId === "collapse-expense" || expenses.length === 0}
                onClick={() => void structurePlan("collapse", "expense")}
              >
                {busyId === "collapse-expense"
                  ? "…"
                  : "Свернуть расходы в одну строку"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={
                  busyId === "expand-expense" || expenseCats.length === 0
                }
                onClick={() => void structurePlan("expand", "expense")}
              >
                {busyId === "expand-expense"
                  ? "…"
                  : "Разбить расходы по категориям"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busyId === "collapse-income" || incomes.length === 0}
                onClick={() => void structurePlan("collapse", "income")}
              >
                {busyId === "collapse-income"
                  ? "…"
                  : "Свернуть доходы в одну строку"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busyId === "expand-income" || incomeCats.length === 0}
                onClick={() => void structurePlan("expand", "income")}
              >
                {busyId === "expand-income"
                  ? "…"
                  : "Разбить доходы по категориям"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {tab === "categories" && (
        <div className="mt-6 space-y-4 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Конверты и лимиты</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={barsMode === "actual" ? "primary" : "secondary"}
                onClick={() => setBarsMode("actual")}
              >
                Факт / лимит
              </Button>
              <Button
                type="button"
                variant={barsMode === "plan" ? "primary" : "secondary"}
                onClick={() => setBarsMode("plan")}
              >
                План / лимит
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCatalog((v) => !v)}
              >
                {showCatalog ? "Скрыть каталог" : "Каталог категорий"}
              </Button>
            </div>
          </div>
          {showCatalog && (
            <CategoryCatalogPicker
              userCategories={categories}
              expenses={expenses}
              incomes={incomes}
              onAdded={(row) => upsert("budgetCategories", row)}
            />
          )}
          {overspentCount > 0 && (
            <p className="text-sm text-amber-700">
              Перерасход по плану или факту в {overspentCount} категориях
            </p>
          )}
          {statuses.length > 0 && (
            <div className="rounded-xl border border-border bg-background p-4">
              <EnvelopeBars mode={barsMode} statuses={statuses} />
            </div>
          )}
          <ul className="space-y-3">
            {statuses.map((s) => (
              <li
                key={s.categoryId}
                className={`rounded-xl border bg-background p-3 ${
                  s.overspentActual || s.overspent
                    ? "border-red-300"
                    : "border-border"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      План {formatRub(s.plannedMonthly)}
                      {s.monthlyLimit != null
                        ? ` · лимит ${formatRub(s.monthlyLimit)}`
                        : ""}
                      {" · "}
                      факт {formatRub(s.actualMonthly)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busyId === s.categoryId}
                    onClick={() => void removeCategory(s.categoryId)}
                  >
                    Удалить
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <FormField
                    label="Лимит, ₽/мес"
                    htmlFor={`limit-${s.categoryId}`}
                    className="min-w-[10rem] flex-1"
                  >
                    <Input
                      id={`limit-${s.categoryId}`}
                      inputMode="numeric"
                      value={limitDrafts[s.categoryId] ?? ""}
                      onChange={(e) =>
                        setLimitDrafts((prev) => ({
                          ...prev,
                          [s.categoryId]: formatMoneyInput(e.target.value),
                        }))
                      }
                      placeholder="без лимита"
                    />
                  </FormField>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busyId === s.categoryId}
                    onClick={() => void saveLimit(s.categoryId)}
                  >
                    {busyId === s.categoryId ? "…" : "Сохранить"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {incomeCats.length > 0 && (
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                Категории доходов
              </p>
              <ul className="flex flex-wrap gap-2">
                {incomeCats.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm"
                  >
                    <span>{c.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busyId === c.id}
                      onClick={() => void removeCategory(c.id)}
                    >
                      ×
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === "operations" && (
        <div className="mt-6 space-y-4 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => shiftMonth(-1)}>
                ←
              </Button>
              <p className="text-sm font-medium capitalize">
                {monthLabel(year, month)}
              </p>
              <Button type="button" variant="secondary" onClick={() => shiftMonth(1)}>
                →
              </Button>
            </div>
            <Button type="button" onClick={openNewTx}>
              + Операция
            </Button>
          </div>
          {txLoading ? (
            <p className="text-sm text-muted">Загрузка…</p>
          ) : txs.length === 0 ? (
            <p className="text-sm text-muted">
              Нет операций за месяц. Факт не меняет план, пока не нажмёте «Обновить
              план из факта».
            </p>
          ) : (
            <ul className="space-y-2">
              {txs.map((t) => {
                const cat =
                  categories.find((c) => c.id === t.category)?.name ??
                  (t.category === "general" ? "Без категории" : t.category);
                return (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {t.kind === "income" ? "+" : "−"} {t.name}
                      </p>
                      <p className="text-muted">
                        {toInputDate(t.date)} · {cat}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums font-medium">
                        {formatRub(t.amount)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => openEditTx(t)}
                      >
                        Изменить
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={busyId === t.id}
                        onClick={() => void deleteTx(t.id)}
                      >
                        Удалить
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Button
            type="button"
            variant="secondary"
            disabled={busyId === "sync"}
            onClick={() => void syncFromActuals()}
          >
            Обновить план из факта (3 мес.)
          </Button>
        </div>
      )}

      <Modal
        open={txOpen}
        title={txEditId ? "Изменить операцию" : "Новая операция"}
        onClose={() => {
          setTxOpen(false);
          setTxEditId(null);
        }}
      >
        <ModalFormBox>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Тип" htmlFor="tx-kind">
              <select
                id="tx-kind"
                className={selectClass}
                value={txKind}
                onChange={(e) => {
                  const k = e.target.value as "income" | "expense";
                  setTxKind(k);
                  setTxCategory(
                    (k === "expense" ? expenseCats : incomeCats)[0]?.id ??
                      "general",
                  );
                }}
              >
                <option value="expense">Расход</option>
                <option value="income">Доход</option>
              </select>
            </FormField>
            <FormField label="Дата" htmlFor="tx-date">
              <Input
                id="tx-date"
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
              />
            </FormField>
            <FormField label="Название" htmlFor="tx-name">
              <Input
                id="tx-name"
                value={txName}
                onChange={(e) => setTxName(e.target.value)}
                placeholder="Продукты / Зарплата"
              />
            </FormField>
            <FormField label="Сумма, ₽" htmlFor="tx-amount">
              <Input
                id="tx-amount"
                inputMode="numeric"
                value={txAmount}
                onChange={(e) => setTxAmount(formatMoneyInput(e.target.value))}
              />
            </FormField>
            <FormField label="Категория" htmlFor="tx-cat" className="sm:col-span-2">
              <select
                id="tx-cat"
                className={selectClass}
                value={txCategory}
                onChange={(e) => setTxCategory(e.target.value)}
              >
                <option value="general">Без категории</option>
                {(txKind === "expense" ? expenseCats : incomeCats).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </ModalFormBox>
        <ModalFormActions
          onCancel={() => {
            setTxOpen(false);
            setTxEditId(null);
          }}
          onSubmit={() => void saveTx()}
          submitting={busyId === "tx"}
          submitLabel={txEditId ? "Сохранить" : "Добавить"}
        />
      </Modal>
    </Card>
  );
}

function Metric({
  label,
  value,
  hint,
  danger,
}: {
  label: string;
  value: string;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={`mt-1 text-base font-semibold tabular-nums ${
          danger ? "text-red-600" : ""
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
