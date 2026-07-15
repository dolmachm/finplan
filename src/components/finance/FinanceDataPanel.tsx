"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField, HelpHint } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { Modal, ModalFormBox } from "@/components/ui/Modal";
import { toast } from "@/components/ui/ToastProvider";
import { FEATURE_HINTS, FIELD_HINTS } from "@/content/help";
import {
  ASSET_CLASS_LABELS,
  ASSET_TYPE_OPTIONS,
  assetTypeLabel,
  essentialLabel,
  FREQUENCY_OPTIONS,
  frequencyLabel,
  INCOME_SOURCE_LABELS,
  LIABILITY_TYPE_OPTIONS,
  liabilityTypeLabel,
} from "@/shared/finance-catalog";
import type {
  Asset,
  AssetClass,
  AssetType,
  BudgetCategory,
  Expense,
  Income,
  Liability,
  LiabilityType,
} from "@/shared/types";
import { readApiError, parsePositiveNumber } from "@/shared/api-client";
import { formatMoneyInput } from "@/shared/format-input";
import { formatRub } from "@/shared/format";
import { envelopeStatuses, budgetExpenseFloor } from "@/modules/budget/envelopes";
import { EnvelopeBars } from "@/components/finance/EnvelopeOverview";
import { LoanCalculator } from "@/components/finance/LoanCalculator";
import { DebtPayoffStrategies } from "@/components/finance/DebtPayoffStrategies";
import {
  PortfolioHoldingsEditor,
  draftsToHoldings,
  emptyDraft,
  holdingsToDrafts,
} from "@/components/finance/PortfolioHoldingsEditor";
import { computePortfolioMetrics } from "@/modules/finance/portfolio-math";
import { monthlyEquivalent } from "@/modules/plan/frequency";
import type { PlanFrequency } from "@/modules/plan/frequency";

const selectClass =
  "w-full rounded-xl border border-transparent bg-brand-light px-4 py-2.5 text-sm";

const editorActionsClass =
  "mt-5 flex flex-col-reverse gap-2 sm:mt-6 sm:flex-row-reverse sm:justify-center";

const editorBtnClass = "w-full sm:w-auto sm:min-w-[8rem]";

type EditView =
  | { kind: "asset" | "income" | "expense" | "liability"; id?: string }
  | null;

function editModalTitle(view: NonNullable<EditView>): string {
  const isNew = !view.id;
  switch (view.kind) {
    case "asset":
      return isNew ? "Добавить актив" : "Редактировать актив";
    case "liability":
      return isNew ? "Добавить пассив" : "Редактировать пассив";
    case "income":
      return isNew ? "Добавить доход" : "Редактировать доход";
    case "expense":
      return isNew ? "Добавить расход" : "Редактировать расход";
  }
}

export type FinanceDataStatus = {
  assetCount: number;
  liabilityCount: number;
  incomeCount: number;
  expenseCount: number;
  netWorthApprox: number;
};

export function FinanceDataPanel({
  onRefresh,
  onUnauthorized,
  onQuickAdd,
  addingAsset,
  onStatusChange,
  mode = "balance",
}: {
  onRefresh?: () => void;
  onUnauthorized: (res: Response) => boolean;
  onQuickAdd: () => void | Promise<void>;
  addingAsset: boolean;
  onStatusChange?: (status: FinanceDataStatus) => void;
  mode?: "balance" | "cashflow";
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [editView, setEditView] = useState<EditView>(null);
  const [loading, setLoading] = useState(true);

  const statusRef = useRef(onStatusChange);
  statusRef.current = onStatusChange;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, lRes, iRes, eRes, cRes] = await Promise.all([
        fetch("/api/assets", { cache: "no-store" }),
        fetch("/api/liabilities", { cache: "no-store" }),
        fetch("/api/incomes", { cache: "no-store" }),
        fetch("/api/expenses", { cache: "no-store" }),
        fetch("/api/budget-categories", { cache: "no-store" }),
      ]);
      if (
        onUnauthorized(aRes) ||
        onUnauthorized(lRes) ||
        onUnauthorized(iRes) ||
        onUnauthorized(eRes) ||
        onUnauthorized(cRes)
      )
        return;
      const nextAssets: Asset[] = aRes.ok ? await aRes.json() : [];
      const nextLiabilities: Liability[] = lRes.ok ? await lRes.json() : [];
      const nextIncomes: Income[] = iRes.ok ? await iRes.json() : [];
      const nextExpenses: Expense[] = eRes.ok ? await eRes.json() : [];
      const nextCategories: BudgetCategory[] = cRes.ok ? await cRes.json() : [];
      setAssets(nextAssets);
      setLiabilities(nextLiabilities);
      setIncomes(nextIncomes);
      setExpenses(nextExpenses);
      setCategories(nextCategories);
      statusRef.current?.({
        assetCount: nextAssets.length,
        liabilityCount: nextLiabilities.length,
        incomeCount: nextIncomes.length,
        expenseCount: nextExpenses.length,
        netWorthApprox:
          nextAssets.reduce((s, a) => s + a.currentValue, 0) -
          nextLiabilities.reduce((s, l) => s + l.remainingBalance, 0),
      });
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setEditView(null);
  }, [mode]);

  const closeEditor = () => setEditView(null);
  const onEditorSaved = async () => {
    await load();
    setEditView(null);
    onRefresh?.();
  };

  async function handleQuickAdd() {
    await onQuickAdd();
    await load();
  }

  async function remove(
    kind: "asset" | "income" | "expense" | "liability",
    id: string,
  ) {
    try {
      const path =
        kind === "liability" ? `/api/liabilities/${id}` : `/api/${kind}s/${id}`;
      const res = await fetch(path, {
        method: "DELETE",
        cache: "no-store",
      });
      if (onUnauthorized(res)) return;
      if (!res.ok) {
        toast.error("Не удалось удалить");
        return;
      }
      toast.success("Удалено");
      await load();
      onRefresh?.();
    } catch {
      toast.error("Не удалось удалить");
    }
  }

  const assetsTotal = assets.reduce((s, a) => s + a.currentValue, 0);
  const debtTotal = liabilities.reduce((s, l) => s + l.remainingBalance, 0);
  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? (id === "general" ? "Без категории" : id);

  return (
    <section className="space-y-8">
      {mode === "balance" && (
      <div className="space-y-4">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Шаг 1 · Точка 0
              </p>
              <h2 className="mt-1 font-medium">Активы и пассивы</h2>
              <HelpHint className="mt-1">{FEATURE_HINTS.pointZero}</HelpHint>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditView({ kind: "asset" })}
              >
                + Актив / счёт
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditView({ kind: "liability" })}
              >
                + Пассив
              </Button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <span>
              Активы: <strong>{formatRub(assetsTotal)}</strong>
            </span>
            <span>
              Пассивы: <strong>{formatRub(debtTotal)}</strong>
            </span>
            <span>
              Чистые активы: <strong>{formatRub(assetsTotal - debtTotal)}</strong>
            </span>
          </div>
          <div className="mt-4">
            <HelpHint>{FEATURE_HINTS.demoPortfolio}</HelpHint>
            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={addingAsset}
              className="mt-2 text-sm font-medium text-brand hover:underline disabled:opacity-50"
            >
              {addingAsset ? "Добавление…" : "Добавить демо-портфель 3 млн ₽"}
            </button>
          </div>
        </Card>

        {loading ? (
          <p className="text-muted">Загрузка…</p>
        ) : (
          <>
            <DataTable
              title="Активы и счета"
              empty="Нет активов — добавьте счёт, брокерский портфель или другое"
              columns={["Название", "Тип", "Класс", "Стоимость", "Доход/мес"]}
              items={assets.map((a) => ({
                id: a.id,
                cells: [
                  a.name,
                  assetTypeLabel(a.type),
                  ASSET_CLASS_LABELS[(a.assetClass as AssetClass) ?? "PERSONAL"],
                  formatRub(a.currentValue),
                  a.dividendIncomeMonthly ? formatRub(a.dividendIncomeMonthly) : "—",
                ],
              }))}
              onEdit={(id) => setEditView({ kind: "asset", id })}
              onDelete={(id) => remove("asset", id)}
            />
            <DataTable
              title="Пассивы"
              empty="Нет пассивов — добавьте ипотеку, кредит или карту при наличии"
              columns={["Название", "Тип", "Остаток", "Ставка %", "Платёж/мес"]}
              items={liabilities.map((l) => ({
                id: l.id,
                cells: [
                  l.name,
                  liabilityTypeLabel(l.type),
                  formatRub(l.remainingBalance),
                  String(l.interestRatePct),
                  formatRub(l.monthlyPayment),
                ],
              }))}
              onEdit={(id) => setEditView({ kind: "liability", id })}
              onDelete={(id) => remove("liability", id)}
            />
            <LoanCalculator />
            <DebtPayoffStrategies liabilities={liabilities} />
          </>
        )}
      </div>
      )}

      {mode === "cashflow" && (
      <div className="space-y-4">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Шаг 2 · Денежный поток
              </p>
              <h2 className="mt-1 font-medium">Доходы и расходы</h2>
              <HelpHint className="mt-1">{FEATURE_HINTS.cashflowStep}</HelpHint>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditView({ kind: "income" })}
              >
                + Доход
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditView({ kind: "expense" })}
              >
                + Расход
              </Button>
            </div>
          </div>
        </Card>

        {!loading && (
          <>
            <DataTable
              title="Доходы"
              empty="Нет доходов"
              columns={["Название", "Источник", "Сумма", "Период", "Тип"]}
              items={incomes.map((i) => ({
                id: i.id,
                cells: [
                  i.name,
                  INCOME_SOURCE_LABELS[i.source] ?? i.source,
                  formatRub(i.amount),
                  frequencyLabel(i.frequency),
                  essentialLabel(i.isEssential ?? true),
                ],
              }))}
              onEdit={(id) => setEditView({ kind: "income", id })}
              onDelete={(id) => remove("income", id)}
            />
            <DataTable
              title="Расходы"
              empty="Нет расходов"
              columns={["Название", "Категория", "Сумма", "Период", "Тип"]}
              items={expenses.map((e) => ({
                id: e.id,
                cells: [
                  e.name,
                  categoryName(e.category),
                  formatRub(e.amount),
                  frequencyLabel(e.frequency),
                  essentialLabel(e.isEssential),
                ],
              }))}
              onEdit={(id) => setEditView({ kind: "expense", id })}
              onDelete={(id) => remove("expense", id)}
            />
            <BudgetEnvelopesPanel
              categories={categories}
              expenses={expenses}
              incomes={incomes}
              onUnauthorized={onUnauthorized}
              onChanged={async () => {
                await load();
                onRefresh?.();
              }}
            />
          </>
        )}
        {loading && <p className="text-muted">Загрузка…</p>}
      </div>
      )}

      {editView && (
        <Modal
          open
          title={editModalTitle(editView)}
          onClose={closeEditor}
        >
          <ItemEditor
            view={editView}
            assets={assets}
            liabilities={liabilities}
            incomes={incomes}
            expenses={expenses}
            categories={categories}
            onBack={closeEditor}
            onSaved={onEditorSaved}
            onUnauthorized={onUnauthorized}
          />
        </Modal>
      )}
    </section>
  );
}

function DataTable({
  title,
  empty,
  columns,
  items,
  onEdit,
  onDelete,
}: {
  title: string;
  empty: string;
  columns: string[];
  items: Array<{ id: string; cells: string[] }>;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <h3 className="font-medium">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      ) : (
        <>
          <div className="mt-4 space-y-3 md:hidden">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-border bg-background p-3"
              >
                <p className="font-medium text-foreground">{item.cells[0]}</p>
                <dl className="mt-2 space-y-1">
                  {columns.slice(1).map((col, ci) => (
                    <div key={col} className="flex justify-between gap-3 text-sm">
                      <dt className="text-muted">{col}</dt>
                      <dd className="text-right text-foreground">{item.cells[ci + 1]}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 flex gap-2 border-t border-border pt-3">
                  <Button type="button" variant="secondary" className="flex-1" onClick={() => onEdit(item.id)}>
                    Изменить
                  </Button>
                  <Button type="button" variant="ghost" className="flex-1" onClick={() => onDelete(item.id)}>
                    Удалить
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  {columns.map((c) => (
                    <th key={c} className="px-3 py-2 font-medium">
                      {c}
                    </th>
                  ))}
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    {item.cells.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2">
                        {cell}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Button type="button" variant="ghost" onClick={() => onEdit(item.id)}>
                        Изменить
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => onDelete(item.id)}>
                        Удалить
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

function ItemEditor({
  view,
  assets,
  liabilities,
  incomes,
  expenses,
  categories,
  onBack,
  onSaved,
  onUnauthorized,
}: {
  view: NonNullable<EditView>;
  assets: Asset[];
  liabilities: Liability[];
  incomes: Income[];
  expenses: Expense[];
  categories: BudgetCategory[];
  onBack: () => void;
  onSaved: () => void | Promise<void>;
  onUnauthorized: (res: Response) => boolean;
}) {
  if (view.kind === "asset") {
    const existing = assets.find((a) => a.id === view.id);
    return (
      <AssetEditor
        existing={existing}
        onBack={onBack}
        onSaved={onSaved}
        onUnauthorized={onUnauthorized}
      />
    );
  }
  if (view.kind === "liability") {
    const existing = liabilities.find((l) => l.id === view.id);
    return (
      <LiabilityEditor
        existing={existing}
        onBack={onBack}
        onSaved={onSaved}
        onUnauthorized={onUnauthorized}
      />
    );
  }
  if (view.kind === "income") {
    const existing = incomes.find((i) => i.id === view.id);
    return (
      <IncomeEditor
        existing={existing}
        onBack={onBack}
        onSaved={onSaved}
        onUnauthorized={onUnauthorized}
      />
    );
  }
  const existing = expenses.find((e) => e.id === view.id);
  return (
    <ExpenseEditor
      existing={existing}
      categories={categories}
      onBack={onBack}
      onSaved={onSaved}
      onUnauthorized={onUnauthorized}
    />
  );
}

function AssetEditor({
  existing,
  onBack,
  onSaved,
  onUnauthorized,
}: {
  existing?: Asset;
  onBack: () => void;
  onSaved: () => void | Promise<void>;
  onUnauthorized: (res: Response) => boolean;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [type, setType] = useState<AssetType>(existing?.type ?? "BROKERAGE");
  const [assetClass, setAssetClass] = useState<AssetClass>(
    existing?.assetClass ?? "INVESTMENT",
  );
  const [currentValue, setCurrentValue] = useState(
    existing ? formatMoneyInput(String(existing.currentValue)) : "",
  );
  const [expectedReturnPct, setExpectedReturnPct] = useState(
    String(existing?.expectedReturnPct ?? 7),
  );
  const [volatilityPct, setVolatilityPct] = useState(
    String(existing?.volatilityPct ?? 12),
  );
  const [dividendIncomeMonthly, setDividendIncomeMonthly] = useState(
    existing?.dividendIncomeMonthly
      ? formatMoneyInput(String(existing.dividendIncomeMonthly))
      : "",
  );
  const [maintenanceCostMonthly, setMaintenanceCostMonthly] = useState(
    existing?.maintenanceCostMonthly
      ? formatMoneyInput(String(existing.maintenanceCostMonthly))
      : "",
  );
  const [holdingDrafts, setHoldingDrafts] = useState(() =>
    holdingsToDrafts(existing?.portfolioHoldings),
  );
  const [saving, setSaving] = useState(false);

  const holdings = draftsToHoldings(holdingDrafts);
  const hasHoldings = assetClass === "INVESTMENT" && holdings.length > 0;
  const portfolioMetrics = hasHoldings
    ? computePortfolioMetrics(holdings)
    : null;

  function onTypeChange(next: AssetType) {
    setType(next);
    const opt = ASSET_TYPE_OPTIONS.find((o) => o.value === next);
    if (opt) setAssetClass(opt.class);
  }

  function onHoldingsChange(
    next: ReturnType<typeof holdingsToDrafts>,
  ) {
    setHoldingDrafts(next);
    const nextHoldings = draftsToHoldings(next);
    if (nextHoldings.length === 0) return;
    const m = computePortfolioMetrics(nextHoldings);
    setCurrentValue(formatMoneyInput(String(Math.round(m.totalValue))));
    setExpectedReturnPct(String(m.expectedReturnPct.toFixed(2)));
    setVolatilityPct(String(m.volatilityPct.toFixed(2)));
    setDividendIncomeMonthly(
      m.dividendIncomeMonthly > 0
        ? formatMoneyInput(String(Math.round(m.dividendIncomeMonthly)))
        : "",
    );
  }

  async function save() {
    const portfolioHoldings =
      assetClass === "INVESTMENT" ? draftsToHoldings(holdingDrafts) : [];
    const useRollup = portfolioHoldings.length > 0;
    const rollup = useRollup
      ? computePortfolioMetrics(portfolioHoldings)
      : null;

    const value = useRollup
      ? { ok: true as const, value: rollup!.totalValue }
      : parsePositiveNumber(currentValue, "Стоимость");
    if (!name.trim()) {
      toast.error("Укажите название");
      return;
    }
    if (!value.ok) {
      toast.error(value.message);
      return;
    }
    const rent = useRollup
      ? { ok: true as const, value: rollup!.dividendIncomeMonthly }
      : dividendIncomeMonthly
        ? parsePositiveNumber(dividendIncomeMonthly, "Доход")
        : { ok: true as const, value: 0 };
    const maint = maintenanceCostMonthly
      ? parsePositiveNumber(maintenanceCostMonthly, "Расход на содержание")
      : { ok: true as const, value: 0 };
    if (!rent.ok) {
      toast.error(rent.message);
      return;
    }
    if (!maint.ok) {
      toast.error(maint.message);
      return;
    }

    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        type,
        assetClass,
        currentValue: value.value,
        expectedReturnPct: useRollup
          ? rollup!.expectedReturnPct
          : Number(expectedReturnPct) || 0,
        volatilityPct: useRollup
          ? rollup!.volatilityPct
          : Number(volatilityPct) || 0,
        dividendIncomeMonthly: rent.value,
        maintenanceCostMonthly: maint.value,
        portfolioHoldings:
          assetClass === "INVESTMENT" ? portfolioHoldings : [],
      };
      const res = await fetch(
        existing ? `/api/assets/${existing.id}` : "/api/assets",
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
      toast.success(existing ? "Актив обновлён" : "Актив добавлен");
      await onSaved();
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalFormBox>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Название" htmlFor="asset-name">
          <Input id="asset-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Брокерский счёт Тинькофф" />
        </FormField>
        <FormField label="Тип актива" htmlFor="asset-type">
          <select id="asset-type" className={selectClass} value={type} onChange={(e) => onTypeChange(e.target.value as AssetType)}>
            <optgroup label="Личные">
              {ASSET_TYPE_OPTIONS.filter((o) => o.class === "PERSONAL").map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </optgroup>
            <optgroup label="Инвестиционные">
              {ASSET_TYPE_OPTIONS.filter((o) => o.class === "INVESTMENT").map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </optgroup>
          </select>
        </FormField>
        <FormField
          label="Текущая стоимость, ₽"
          htmlFor="asset-value"
          hint={
            hasHoldings
              ? "Считается как сумма позиций портфеля"
              : undefined
          }
        >
          <Input
            id="asset-value"
            inputMode="numeric"
            value={
              hasHoldings && portfolioMetrics
                ? formatMoneyInput(String(Math.round(portfolioMetrics.totalValue)))
                : currentValue
            }
            onChange={(e) => setCurrentValue(formatMoneyInput(e.target.value))}
            placeholder="1 000 000"
            disabled={hasHoldings}
          />
        </FormField>
      </div>
      {assetClass === "INVESTMENT" && holdingDrafts.length > 0 && (
        <PortfolioHoldingsEditor
          drafts={holdingDrafts}
          onChange={onHoldingsChange}
        />
      )}
      {assetClass === "INVESTMENT" && holdingDrafts.length === 0 && (
        <div className="mt-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onHoldingsChange([emptyDraft()])}
          >
            + Разбить на классы активов
          </Button>
        </div>
      )}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-muted hover:text-foreground">
          Ещё настройки
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FormField label="Доходность, % годовых" htmlFor="asset-return" hint={FIELD_HINTS.expectedReturn}>
            <Input
              id="asset-return"
              inputMode="decimal"
              value={
                hasHoldings && portfolioMetrics
                  ? portfolioMetrics.expectedReturnPct.toFixed(2)
                  : expectedReturnPct
              }
              onChange={(e) => setExpectedReturnPct(e.target.value)}
              placeholder="7"
              disabled={hasHoldings}
            />
          </FormField>
          <FormField label="Риск (волатильность), %" htmlFor="asset-vol" hint={FIELD_HINTS.volatility}>
            <Input
              id="asset-vol"
              inputMode="decimal"
              value={
                hasHoldings && portfolioMetrics
                  ? portfolioMetrics.volatilityPct.toFixed(2)
                  : volatilityPct
              }
              onChange={(e) => setVolatilityPct(e.target.value)}
              placeholder="12"
              disabled={hasHoldings}
            />
          </FormField>
          <FormField label="Доход в месяц, ₽" htmlFor="asset-rent" hint={FIELD_HINTS.dividendRent}>
            <Input
              id="asset-rent"
              inputMode="numeric"
              value={
                hasHoldings && portfolioMetrics
                  ? portfolioMetrics.dividendIncomeMonthly > 0
                    ? formatMoneyInput(
                        String(Math.round(portfolioMetrics.dividendIncomeMonthly)),
                      )
                    : ""
                  : dividendIncomeMonthly
              }
              onChange={(e) => setDividendIncomeMonthly(formatMoneyInput(e.target.value))}
              placeholder="30 000"
              disabled={hasHoldings}
            />
          </FormField>
          <FormField label="Содержание в месяц, ₽" htmlFor="asset-maint" hint={FIELD_HINTS.maintenance}>
            <Input id="asset-maint" inputMode="numeric" value={maintenanceCostMonthly} onChange={(e) => setMaintenanceCostMonthly(formatMoneyInput(e.target.value))} placeholder="5 000" />
          </FormField>
        </div>
      </details>
      <div className={editorActionsClass}>
        <Button type="button" variant="secondary" className={editorBtnClass} onClick={onBack}>
          Отмена
        </Button>
        <Button type="button" className={editorBtnClass} onClick={save} disabled={saving}>
          {saving ? "Сохранение…" : existing ? "Сохранить" : "Добавить"}
        </Button>
      </div>
    </ModalFormBox>
  );
}

function IncomeEditor({
  existing,
  onBack,
  onSaved,
  onUnauthorized,
}: {
  existing?: Income;
  onBack: () => void;
  onSaved: () => void | Promise<void>;
  onUnauthorized: (res: Response) => boolean;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [source, setSource] = useState(existing?.source ?? "SALARY");
  const [amount, setAmount] = useState(
    existing ? formatMoneyInput(String(existing.amount)) : "",
  );
  const [frequency, setFrequency] = useState(existing?.frequency ?? "MONTHLY");
  const [isEssential, setIsEssential] = useState(existing?.isEssential ?? true);
  const [taxRatePct, setTaxRatePct] = useState(String(existing?.taxRatePct ?? 13));
  const [saving, setSaving] = useState(false);

  async function save() {
    const amountNum = parsePositiveNumber(amount, "Сумма");
    if (!name.trim()) {
      toast.error("Укажите название");
      return;
    }
    if (!amountNum.ok) {
      toast.error(amountNum.message);
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        source,
        amount: amountNum.value,
        frequency,
        isEssential,
        taxRatePct: Number(taxRatePct) || 0,
      };
      const res = await fetch(
        existing ? `/api/incomes/${existing.id}` : "/api/incomes",
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
      toast.success(existing ? "Доход обновлён" : "Доход добавлен");
      await onSaved();
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalFormBox>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Название" htmlFor="income-name">
          <Input id="income-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Зарплата / Премия" />
        </FormField>
        <FormField label="Сумма, ₽" htmlFor="income-amount" hint="За один период (см. ниже)">
          <Input id="income-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(formatMoneyInput(e.target.value))} placeholder="120 000" />
        </FormField>
        <FormField label="Периодичность" htmlFor="income-freq">
          <select id="income-freq" className={selectClass} value={frequency} onChange={(e) => setFrequency(e.target.value as Income["frequency"])}>
            {FREQUENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </FormField>
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-muted hover:text-foreground">
          Ещё настройки
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FormField label="Источник" htmlFor="income-source">
            <select id="income-source" className={selectClass} value={source} onChange={(e) => setSource(e.target.value as Income["source"])}>
              {Object.entries(INCOME_SOURCE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Тип дохода" htmlFor="income-kind" hint="Обязательный — зарплата; переменный — премия, бонус">
            <select id="income-kind" className={selectClass} value={isEssential ? "1" : "0"} onChange={(e) => setIsEssential(e.target.value === "1")}>
              <option value="1">Обязательный (регулярный)</option>
              <option value="0">Переменный</option>
            </select>
          </FormField>
          <FormField label="Налог, %" htmlFor="income-tax">
            <Input id="income-tax" inputMode="decimal" value={taxRatePct} onChange={(e) => setTaxRatePct(e.target.value)} placeholder="13" />
          </FormField>
        </div>
      </details>
      <div className={editorActionsClass}>
        <Button type="button" variant="secondary" className={editorBtnClass} onClick={onBack}>
          Отмена
        </Button>
        <Button type="button" className={editorBtnClass} onClick={save} disabled={saving}>
          {saving ? "Сохранение…" : existing ? "Сохранить" : "Добавить"}
        </Button>
      </div>
    </ModalFormBox>
  );
}

function ExpenseEditor({
  existing,
  categories,
  onBack,
  onSaved,
  onUnauthorized,
}: {
  existing?: Expense;
  categories: BudgetCategory[];
  onBack: () => void;
  onSaved: () => void | Promise<void>;
  onUnauthorized: (res: Response) => boolean;
}) {
  const expenseCategories = categories.filter((c) => c.kind === "expense");
  const defaultCat =
    (existing?.category &&
      expenseCategories.some((c) => c.id === existing.category) &&
      existing.category) ||
    expenseCategories[0]?.id ||
    "general";
  const [name, setName] = useState(existing?.name ?? "");
  const [amount, setAmount] = useState(
    existing ? formatMoneyInput(String(existing.amount)) : "",
  );
  const [frequency, setFrequency] = useState(existing?.frequency ?? "MONTHLY");
  const [category, setCategory] = useState(defaultCat);
  const [isEssential, setIsEssential] = useState(existing?.isEssential ?? true);
  const [saving, setSaving] = useState(false);

  async function save() {
    const amountNum = parsePositiveNumber(amount, "Сумма");
    if (!name.trim()) {
      toast.error("Укажите название");
      return;
    }
    if (!amountNum.ok) {
      toast.error(amountNum.message);
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        category: category.trim() || "general",
        amount: amountNum.value,
        frequency,
        isEssential,
      };
      const res = await fetch(
        existing ? `/api/expenses/${existing.id}` : "/api/expenses",
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
      toast.success(existing ? "Расход обновлён" : "Расход добавлен");
      await onSaved();
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalFormBox>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Название" htmlFor="expense-name">
          <Input id="expense-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ипотека / ОСАГО" />
        </FormField>
        <FormField label="Сумма, ₽" htmlFor="expense-amount" hint="За выбранный период">
          <Input id="expense-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(formatMoneyInput(e.target.value))} placeholder="15 000" />
        </FormField>
        <FormField label="Периодичность" htmlFor="expense-freq">
          <select id="expense-freq" className={selectClass} value={frequency} onChange={(e) => setFrequency(e.target.value as Expense["frequency"])}>
            {FREQUENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Категория" htmlFor="expense-category" hint="Для конверта бюджета">
          <select
            id="expense-category"
            className={selectClass}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {expenseCategories.length === 0 ? (
              <option value="general">Без категории</option>
            ) : (
              expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))
            )}
          </select>
        </FormField>
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-muted hover:text-foreground">
          Ещё настройки
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FormField label="Тип расхода" htmlFor="expense-kind" hint="Обязательный — аренда; переменный — ТО, страховка раз в год">
            <select id="expense-kind" className={selectClass} value={isEssential ? "1" : "0"} onChange={(e) => setIsEssential(e.target.value === "1")}>
              <option value="1">Обязательный</option>
              <option value="0">Переменный</option>
            </select>
          </FormField>
        </div>
      </details>
      <div className={editorActionsClass}>
        <Button type="button" variant="secondary" className={editorBtnClass} onClick={onBack}>
          Отмена
        </Button>
        <Button type="button" className={editorBtnClass} onClick={save} disabled={saving}>
          {saving ? "Сохранение…" : existing ? "Сохранить" : "Добавить"}
        </Button>
      </div>
    </ModalFormBox>
  );
}

function LiabilityEditor({
  existing,
  onBack,
  onSaved,
  onUnauthorized,
}: {
  existing?: Liability;
  onBack: () => void;
  onSaved: () => void | Promise<void>;
  onUnauthorized: (res: Response) => boolean;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [type, setType] = useState<LiabilityType>(existing?.type ?? "MORTGAGE");
  const [remainingBalance, setRemainingBalance] = useState(
    existing ? formatMoneyInput(String(existing.remainingBalance)) : "",
  );
  const [interestRatePct, setInterestRatePct] = useState(
    String(existing?.interestRatePct ?? 12),
  );
  const [monthlyPayment, setMonthlyPayment] = useState(
    existing ? formatMoneyInput(String(existing.monthlyPayment)) : "",
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    const balance = parsePositiveNumber(remainingBalance, "Остаток долга");
    const payment = parsePositiveNumber(monthlyPayment, "Платёж");
    if (!name.trim()) {
      toast.error("Укажите название");
      return;
    }
    if (!balance.ok) {
      toast.error(balance.message);
      return;
    }
    if (!payment.ok) {
      toast.error(payment.message);
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        type,
        remainingBalance: balance.value,
        interestRatePct: Number(interestRatePct) || 0,
        monthlyPayment: payment.value,
        currency: "RUB",
      };
      const res = await fetch(
        existing ? `/api/liabilities/${existing.id}` : "/api/liabilities",
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
      toast.success(existing ? "Пассив обновлён" : "Пассив добавлен");
      await onSaved();
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalFormBox>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Название" htmlFor="liability-name">
          <Input
            id="liability-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ипотека Сбер"
          />
        </FormField>
        <FormField label="Тип" htmlFor="liability-type">
          <select
            id="liability-type"
            className={selectClass}
            value={type}
            onChange={(e) => setType(e.target.value as LiabilityType)}
          >
            {LIABILITY_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Остаток долга, ₽" htmlFor="liability-balance">
          <Input
            id="liability-balance"
            inputMode="numeric"
            value={remainingBalance}
            onChange={(e) => setRemainingBalance(formatMoneyInput(e.target.value))}
            placeholder="3 500 000"
          />
        </FormField>
        <FormField label="Ставка, % годовых" htmlFor="liability-rate">
          <Input
            id="liability-rate"
            inputMode="decimal"
            value={interestRatePct}
            onChange={(e) => setInterestRatePct(e.target.value)}
            placeholder="12"
          />
        </FormField>
        <FormField label="Платёж в месяц, ₽" htmlFor="liability-payment">
          <Input
            id="liability-payment"
            inputMode="numeric"
            value={monthlyPayment}
            onChange={(e) => setMonthlyPayment(formatMoneyInput(e.target.value))}
            placeholder="45 000"
          />
        </FormField>
      </div>
      <div className={editorActionsClass}>
        <Button type="button" variant="secondary" className={editorBtnClass} onClick={onBack}>
          Отмена
        </Button>
        <Button type="button" className={editorBtnClass} onClick={save} disabled={saving}>
          {saving ? "Сохранение…" : existing ? "Сохранить" : "Добавить"}
        </Button>
      </div>
    </ModalFormBox>
  );
}

function BudgetEnvelopesPanel({
  categories,
  expenses,
  incomes,
  onUnauthorized,
  onChanged,
}: {
  categories: BudgetCategory[];
  expenses: Expense[];
  incomes: Income[];
  onUnauthorized: (res: Response) => boolean;
  onChanged: () => void | Promise<void>;
}) {
  const statuses = envelopeStatuses(expenses, categories);
  const [limitDrafts, setLimitDrafts] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const incomeMonthly = incomes.reduce(
    (s, i) => s + monthlyEquivalent(i.amount, i.frequency as PlanFrequency),
    0,
  );
  const plannedTotal = expenses.reduce(
    (s, e) => s + monthlyEquivalent(e.amount, e.frequency as PlanFrequency),
    0,
  );
  const limitTotal = statuses
    .filter((s) => s.monthlyLimit != null)
    .reduce((s, e) => s + (e.monthlyLimit as number), 0);
  const floor = budgetExpenseFloor(expenses, categories);
  const afterBudget = incomeMonthly - floor;
  const overspentCount = statuses.filter((s) => s.overspent).length;

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const c of categories) {
      if (c.kind !== "expense") continue;
      next[c.id] =
        c.monthlyLimit == null ? "" : formatMoneyInput(String(c.monthlyLimit));
    }
    setLimitDrafts(next);
  }, [categories]);

  async function saveLimit(id: string) {
    const raw = limitDrafts[id] ?? "";
    let monthlyLimit: number | null = null;
    if (raw.trim()) {
      const parsed = parsePositiveNumber(raw, "Лимит");
      if (!parsed.ok) {
        toast.error(parsed.message);
        return;
      }
      monthlyLimit = parsed.value;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/budget-categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyLimit }),
      });
      if (onUnauthorized(res)) return;
      if (!res.ok) {
        const { message } = await readApiError(res);
        toast.error(message);
        return;
      }
      toast.success("Лимит сохранён");
      await onChanged();
    } catch {
      toast.error("Не удалось сохранить лимит");
    } finally {
      setBusyId(null);
    }
  }

  async function addCategory() {
    if (!newName.trim()) {
      toast.error("Укажите название категории");
      return;
    }
    setBusyId("__new__");
    try {
      const res = await fetch("/api/budget-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          kind: "expense",
          monthlyLimit: null,
        }),
      });
      if (onUnauthorized(res)) return;
      if (!res.ok) {
        const { message } = await readApiError(res);
        toast.error(message);
        return;
      }
      setNewName("");
      toast.success("Категория добавлена");
      await onChanged();
    } catch {
      toast.error("Не удалось добавить категорию");
    } finally {
      setBusyId(null);
    }
  }

  async function removeCategory(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/budget-categories/${id}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (onUnauthorized(res)) return;
      if (!res.ok) {
        toast.error("Не удалось удалить");
        return;
      }
      toast.success("Категория удалена");
      await onChanged();
    } catch {
      toast.error("Не удалось удалить");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Опционально · Бюджет
        </p>
        <h3 className="mt-1 font-medium">Конверты по категориям</h3>
        <HelpHint className="mt-1">
          Месячный лимит — потолок категории. Запланированные расходы
          сравниваются с лимитом; в инвест-плане учитывается резерв конвертов.
        </HelpHint>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs text-muted">Расходы / мес</p>
          <p className="mt-1 text-base font-semibold tabular-nums">
            {formatRub(plannedTotal)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs text-muted">Лимиты / мес</p>
          <p className="mt-1 text-base font-semibold tabular-nums">
            {limitTotal > 0 ? formatRub(limitTotal) : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs text-muted">После бюджета</p>
          <p
            className={`mt-1 text-base font-semibold tabular-nums ${
              afterBudget < 0 ? "text-red-600" : ""
            }`}
          >
            {formatRub(afterBudget)}
          </p>
        </div>
      </div>

      {overspentCount > 0 && (
        <p className="mt-3 text-sm text-amber-700">
          Перерасход в {overspentCount}{" "}
          {overspentCount === 1 ? "категории" : "категориях"} — см. ниже
        </p>
      )}

      {statuses.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-background p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
            Сводка
          </p>
          <EnvelopeBars statuses={statuses} />
        </div>
      )}

      {statuses.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Категории пока не созданы</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {statuses.map((s) => (
            <li
              key={s.categoryId}
              className={`rounded-xl border bg-background p-3 ${
                s.overspent ? "border-red-300" : "border-border"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {formatRub(s.plannedMonthly)}/мес
                    {s.monthlyLimit != null
                      ? ` из ${formatRub(s.monthlyLimit)}`
                      : " · без лимита"}
                    {s.remaining != null && (
                      <span
                        className={
                          s.overspent ? " text-red-600" : " text-foreground"
                        }
                      >
                        {" "}
                        ·{" "}
                        {s.overspent
                          ? `−${formatRub(-s.remaining)}`
                          : `+${formatRub(s.remaining)}`}
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busyId === s.categoryId}
                  onClick={() => removeCategory(s.categoryId)}
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
                  onClick={() => saveLimit(s.categoryId)}
                >
                  {busyId === s.categoryId ? "…" : "Сохранить"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
        <FormField label="Новая категория" htmlFor="new-cat" className="min-w-[12rem] flex-1">
          <Input
            id="new-cat"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Например, Дети"
          />
        </FormField>
        <Button
          type="button"
          variant="secondary"
          disabled={busyId === "__new__"}
          onClick={addCategory}
        >
          + Категория
        </Button>
      </div>
    </Card>
  );
}
