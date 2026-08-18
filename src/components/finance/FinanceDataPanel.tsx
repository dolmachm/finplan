"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField, HelpHint } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { Modal, ModalFormBox, ModalFormActions } from "@/components/ui/Modal";
import { selectClass } from "@/components/ui/form-controls";
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
  LIABILITY_URGENCY_OPTIONS,
  liabilityTypeLabel,
  liabilityUrgencyLabel,
} from "@/shared/finance-catalog";
import type {
  Asset,
  AssetClass,
  AssetType,
  BudgetCategory,
  BudgetCategoryKind,
  Expense,
  Income,
  Liability,
  LiabilityType,
  LiabilityUrgency,
} from "@/shared/types";
import { readApiError, parsePositiveNumber } from "@/shared/api-client";
import { apiFetch } from "@/shared/api-fetch";
import { ensureOnlineForWrite } from "@/shared/offline";
import { formatMoneyInput } from "@/shared/format-input";
import { formatRub } from "@/shared/format";
import { envelopeStatuses, budgetExpenseFloor } from "@/modules/budget/envelopes";
import type { FinancialScore } from "@/modules/dashboard/scoring";
import { useFinanceStore } from "@/modules/finance/finance-store";
import { activeLiabilities } from "@/modules/finance/liability-status";
import { EnvelopeBars } from "@/components/finance/EnvelopeOverview";
import { CategoryCatalogPicker } from "@/components/finance/CategoryCatalogPicker";
import { topFrequentCategories } from "@/shared/category-catalog";
import { LoanCalculator } from "@/components/finance/LoanCalculator";
import { DebtPayoffStrategies } from "@/components/finance/DebtPayoffStrategies";
import { ScoreCard } from "@/components/finance/ScoreCard";
import { SubNav } from "@/components/ui/SubNav";
import {
  PortfolioHoldingsEditor,
  draftsToHoldings,
  emptyDraft,
  holdingsToDrafts,
} from "@/components/finance/PortfolioHoldingsEditor";
import { computePortfolioMetrics } from "@/modules/finance/portfolio-math";
import { monthlyEquivalent } from "@/modules/plan/frequency";
import type { PlanFrequency } from "@/modules/plan/frequency";

type EditView =
  | { kind: "asset" | "income" | "expense" | "liability"; id?: string }
  | null;

type WealthSubPage = "accounts" | "assets" | "liabilities";

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

function CategorySelect({
  id,
  kind,
  value,
  onChange,
  categories,
  lines,
}: {
  id: string;
  kind: BudgetCategoryKind;
  value: string;
  onChange: (v: string) => void;
  categories: BudgetCategory[];
  lines: Array<{ category?: string | null }>;
}) {
  const ofKind = categories.filter((c) => c.kind === kind);
  const top = topFrequentCategories(kind, ofKind, lines);
  const topIds = new Set(top.map((c) => c.id));
  const rest = ofKind.filter((c) => !topIds.has(c.id));
  return (
    <select
      id={id}
      className={selectClass}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="general">Без категории</option>
      {top.length > 0 && (
        <optgroup label="Ваш топ-5">
          {top.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </optgroup>
      )}
      {rest.length > 0 && (
        <optgroup label="Все категории">
          {rest.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

export type FinanceDataStatus = {
  assetCount: number;
  liabilityCount: number;
  incomeCount: number;
  expenseCount: number;
  netWorthApprox: number;
};

export function FinanceDataPanel({
  onQuickAdd,
  addingAsset,
  score = null,
  mode = "balance",
}: {
  onQuickAdd: () => void | Promise<void>;
  addingAsset: boolean;
  score?: FinancialScore | null;
  mode?: "balance" | "cashflow";
}) {
  const {
    assets,
    liabilities,
    incomes,
    expenses,
    budgetCategories: categories,
    entitiesLoading: loading,
    remove: removeEntity,
  } = useFinanceStore();
  const [editView, setEditView] = useState<EditView>(null);
  const [wealthSubPage, setWealthSubPage] = useState<WealthSubPage>("accounts");

  useEffect(() => {
    setEditView(null);
  }, [mode]);

  const closeEditor = () => setEditView(null);
  const onEditorSaved = () => {
    setEditView(null);
  };

  async function handleQuickAdd() {
    await onQuickAdd();
  }

  async function remove(
    kind: "asset" | "income" | "expense" | "liability",
    id: string,
  ) {
    if (!ensureOnlineForWrite()) return;
    try {
      const path =
        kind === "liability" ? `/api/liabilities/${id}` : `/api/${kind}s/${id}`;
      const res = await apiFetch(path, { method: "DELETE" });
      if (!res) return;
      if (!res.ok) {
        toast.error("Не удалось удалить");
        return;
      }
      const key =
        kind === "asset"
          ? "assets"
          : kind === "income"
            ? "incomes"
            : kind === "expense"
              ? "expenses"
              : "liabilities";
      removeEntity(key, id);
      toast.success("Удалено");
    } catch {
      toast.error("Не удалось удалить");
    }
  }

  const assetsTotal = assets.reduce((s, a) => s + a.currentValue, 0);
  const activeDebts = activeLiabilities(liabilities);
  const archivedDebts = liabilities.filter((l) => !activeLiabilities([l]).length);
  const debtTotal = activeDebts.reduce((s, l) => s + l.remainingBalance, 0);
  const accountAssetTypes = new Set<AssetType>(["CASH", "BANK_ACCOUNT", "DEPOSIT"]);
  const accountAssets = assets.filter((a) => accountAssetTypes.has(a.type));
  const investmentAssets = assets.filter((a) => !accountAssetTypes.has(a.type));
  const accountAssetsTotal = accountAssets.reduce((s, a) => s + a.currentValue, 0);
  const investmentAssetsTotal = investmentAssets.reduce((s, a) => s + a.currentValue, 0);
  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? (id === "general" ? "Без категории" : id);

  const tabScore = score;

  return (
    <section className="space-y-8">
      {mode === "balance" && (
      <div className="space-y-4">
        {tabScore && (
          <ScoreCard score={tabScore} mode="block" blockId="wealth" compact />
        )}
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
              Обязательства: <strong>{formatRub(debtTotal)}</strong>
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

        <SubNav
          items={[
            { id: "accounts", label: "Счета" },
            { id: "assets", label: "Активы" },
            { id: "liabilities", label: "Обязательства" },
          ]}
          value={wealthSubPage}
          onChange={setWealthSubPage}
        />

        {loading ? (
          <p className="text-muted">Загрузка…</p>
        ) : (
          <>
            {wealthSubPage === "accounts" && (
              <>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">
                        Подстраница · Счета
                      </p>
                      <h3 className="mt-1 font-medium">Ликвидные счета и резервы</h3>
                      <HelpHint className="mt-1">
                        Наличные, банковские счета и вклады для оперативного доступа к деньгам.
                      </HelpHint>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setEditView({ kind: "asset" })}
                    >
                      + Счёт
                    </Button>
                  </div>
                  <div className="mt-4 text-sm">
                    На счетах: <strong>{formatRub(accountAssetsTotal)}</strong>
                  </div>
                </Card>
                <DataTable
                  title="Счета"
                  empty="Нет счетов — добавьте наличные, банковский счёт или вклад"
                  columns={["Название", "Тип", "Класс", "Стоимость", "Доход/мес"]}
                  items={accountAssets.map((a) => ({
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
              </>
            )}
            {wealthSubPage === "assets" && (
              <>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">
                        Подстраница · Активы
                      </p>
                      <h3 className="mt-1 font-medium">Инвестиции и имущество</h3>
                      <HelpHint className="mt-1">
                        Портфели, недвижимость, авто и другие активы, влияющие на капитал.
                      </HelpHint>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setEditView({ kind: "asset" })}
                    >
                      + Актив
                    </Button>
                  </div>
                  <div className="mt-4 text-sm">
                    Стоимость активов: <strong>{formatRub(investmentAssetsTotal)}</strong>
                  </div>
                </Card>
                <DataTable
                  title="Активы"
                  empty="Нет активов — добавьте брокерский счёт, недвижимость или другое имущество"
                  columns={["Название", "Тип", "Класс", "Стоимость", "Доход/мес"]}
                  items={investmentAssets.map((a) => ({
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
              </>
            )}
            {wealthSubPage === "liabilities" && (
              <>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">
                        Подстраница · Обязательства
                      </p>
                      <h3 className="mt-1 font-medium">Кредиты, ипотека и долги</h3>
                      <HelpHint className="mt-1">
                        Ведите обязательства отдельно и сразу оценивайте платёж и стратегию погашения.
                      </HelpHint>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setEditView({ kind: "liability" })}
                    >
                      + Обязательство
                    </Button>
                  </div>
                  <div className="mt-4 text-sm">
                    Остаток обязательств: <strong>{formatRub(debtTotal)}</strong>
                  </div>
                </Card>
                <DataTable
                  title="Обязательства"
                  empty="Нет обязательств — добавьте ипотеку, кредит или карту при наличии"
                  columns={["Название", "Тип", "Срочность", "Остаток", "Ставка %", "Платёж/мес"]}
                  items={activeDebts.map((l) => ({
                    id: l.id,
                    cells: [
                      l.name,
                      liabilityTypeLabel(l.type),
                      liabilityUrgencyLabel(l.urgency ?? "MEDIUM"),
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
            {wealthSubPage === "liabilities" && archivedDebts.length > 0 && (
              <DataTable
                title="Архив обязательств"
                empty=""
                columns={["Название", "Тип", "Остаток", "Окончание"]}
                items={archivedDebts.map((l) => ({
                  id: l.id,
                  cells: [
                    l.name,
                    liabilityTypeLabel(l.type),
                    formatRub(l.remainingBalance),
                    l.endDate
                      ? new Date(l.endDate).toLocaleDateString("ru-RU")
                      : "—",
                  ],
                }))}
                onEdit={(id) => setEditView({ kind: "liability", id })}
                onDelete={(id) => remove("liability", id)}
              />
            )}
          </>
        )}
      </div>
      )}

      {mode === "cashflow" && (
      <div className="space-y-4">
        {tabScore && (
          <ScoreCard score={tabScore} mode="block" blockId="budget" compact />
        )}
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
              columns={["Название", "Категория", "Сумма", "Период", "Тип"]}
              items={incomes.map((i) => ({
                id: i.id,
                cells: [
                  i.name,
                  categoryName(i.category ?? "general"),
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
}: {
  view: NonNullable<EditView>;
  assets: Asset[];
  liabilities: Liability[];
  incomes: Income[];
  expenses: Expense[];
  categories: BudgetCategory[];
  onBack: () => void;
  onSaved: () => void | Promise<void>;
}) {
  if (view.kind === "asset") {
    const existing = assets.find((a) => a.id === view.id);
    return (
      <AssetEditor existing={existing} onBack={onBack} onSaved={onSaved} />
    );
  }
  if (view.kind === "liability") {
    const existing = liabilities.find((l) => l.id === view.id);
    return (
      <LiabilityEditor
        existing={existing}
        onBack={onBack}
        onSaved={onSaved}
      />
    );
  }
  if (view.kind === "income") {
    const existing = incomes.find((i) => i.id === view.id);
    return (
      <IncomeEditor
        existing={existing}
        categories={categories}
        incomes={incomes}
        onBack={onBack}
        onSaved={onSaved}
      />
    );
  }
  const existing = expenses.find((e) => e.id === view.id);
  return (
    <ExpenseEditor
      existing={existing}
      categories={categories}
      expenses={expenses}
      onBack={onBack}
      onSaved={onSaved}
    />
  );
}

function AssetEditor({
  existing,
  onBack,
  onSaved,
}: {
  existing?: Asset;
  onBack: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { upsert } = useFinanceStore();
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
    if (!ensureOnlineForWrite()) return;
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
      const res = await apiFetch(
        existing ? `/api/assets/${existing.id}` : "/api/assets",
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
      const saved = (await res.json()) as Asset;
      upsert("assets", saved);
      toast.success(existing ? "Актив обновлён" : "Актив добавлен");
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
          <FormField label="Риск, %" htmlFor="asset-vol" hint={FIELD_HINTS.volatility}>
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

function IncomeEditor({
  existing,
  categories,
  incomes,
  onBack,
  onSaved,
}: {
  existing?: Income;
  categories: BudgetCategory[];
  incomes: Income[];
  onBack: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { upsert } = useFinanceStore();
  const incomeCategories = categories.filter((c) => c.kind === "income");
  const defaultCat =
    (existing?.category &&
      incomeCategories.some((c) => c.id === existing.category) &&
      existing.category) ||
    incomeCategories[0]?.id ||
    "general";
  const [name, setName] = useState(existing?.name ?? "");
  const [source, setSource] = useState(existing?.source ?? "SALARY");
  const [category, setCategory] = useState(defaultCat);
  const [amount, setAmount] = useState(
    existing ? formatMoneyInput(String(existing.amount)) : "",
  );
  const [frequency, setFrequency] = useState(existing?.frequency ?? "MONTHLY");
  const [isEssential, setIsEssential] = useState(existing?.isEssential ?? true);
  const [taxRatePct, setTaxRatePct] = useState(String(existing?.taxRatePct ?? 13));
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!ensureOnlineForWrite()) return;
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
        category: category.trim() || "general",
        amount: amountNum.value,
        frequency,
        isEssential,
        taxRatePct: Number(taxRatePct) || 0,
      };
      const res = await apiFetch(
        existing ? `/api/incomes/${existing.id}` : "/api/incomes",
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
      upsert("incomes", (await res.json()) as Income);
      toast.success(existing ? "Доход обновлён" : "Доход добавлен");
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
        <FormField label="Категория" htmlFor="income-category" hint="Из каталога доходов">
          <CategorySelect
            id="income-category"
            kind="income"
            value={category}
            onChange={setCategory}
            categories={categories}
            lines={incomes}
          />
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

function ExpenseEditor({
  existing,
  categories,
  expenses,
  onBack,
  onSaved,
}: {
  existing?: Expense;
  categories: BudgetCategory[];
  expenses: Expense[];
  onBack: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { upsert } = useFinanceStore();
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
    if (!ensureOnlineForWrite()) return;
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
      const res = await apiFetch(
        existing ? `/api/expenses/${existing.id}` : "/api/expenses",
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
      upsert("expenses", (await res.json()) as Expense);
      toast.success(existing ? "Расход обновлён" : "Расход добавлен");
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
          <CategorySelect
            id="expense-category"
            kind="expense"
            value={category}
            onChange={setCategory}
            categories={categories}
            lines={expenses}
          />
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

function LiabilityEditor({
  existing,
  onBack,
  onSaved,
}: {
  existing?: Liability;
  onBack: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { upsert } = useFinanceStore();
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
  const [urgency, setUrgency] = useState<LiabilityUrgency>(
    existing?.urgency ?? "MEDIUM",
  );
  const [endDate, setEndDate] = useState(
    existing?.endDate
      ? new Date(existing.endDate).toISOString().slice(0, 10)
      : "",
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!ensureOnlineForWrite()) return;
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
        urgency,
        endDate: endDate
          ? new Date(`${endDate}T23:59:59.000Z`).toISOString()
          : null,
        currency: "RUB",
        archivedAt:
          endDate &&
          new Date(`${endDate}T23:59:59.000Z`).getTime() < Date.now()
            ? (existing?.archivedAt
                ? new Date(existing.archivedAt).toISOString()
                : new Date().toISOString())
            : null,
      };
      const res = await apiFetch(
        existing ? `/api/liabilities/${existing.id}` : "/api/liabilities",
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
      upsert("liabilities", (await res.json()) as Liability);
      toast.success(existing ? "Пассив обновлён" : "Пассив добавлен");
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
        <FormField
          label="Срочность"
          hint="Высокая — закрываем раньше в плане и стратегиях"
          htmlFor="liability-urgency"
        >
          <select
            id="liability-urgency"
            className={selectClass}
            value={urgency}
            onChange={(e) => setUrgency(e.target.value as LiabilityUrgency)}
          >
            {LIABILITY_URGENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          label="Окончание срока"
          hint="После этой даты кредит уходит в архив и не учитывается в плане"
          htmlFor="liability-end"
        >
          <Input
            id="liability-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </FormField>
      </div>
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

function BudgetEnvelopesPanel({
  categories,
  expenses,
  incomes,
}: {
  categories: BudgetCategory[];
  expenses: Expense[];
  incomes: Income[];
}) {
  const { upsert, remove: removeEntity } = useFinanceStore();
  const statuses = envelopeStatuses(expenses, categories);
  const [limitDrafts, setLimitDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);

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
    if (!ensureOnlineForWrite()) return;
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
      const res = await apiFetch(`/api/budget-categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyLimit }),
      });
      if (!res) return;
      if (!res.ok) {
        const { message } = await readApiError(res);
        toast.error(message);
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

  const incomeCats = categories.filter((c) => c.kind === "income");

  return (
    <Card>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Опционально · Бюджет
        </p>
        <h3 className="mt-1 font-medium">Конверты по категориям</h3>
        <HelpHint className="mt-1">
          Месячный лимит — потолок категории расходов. Добавляйте категории из
          каталога; доходы — для группировки без лимитов.
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

      <div className="mt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Каталог категорий</p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowCatalog((v) => !v)}
          >
            {showCatalog ? "Скрыть" : "Открыть каталог"}
          </Button>
        </div>
        {showCatalog && (
          <CategoryCatalogPicker
            userCategories={categories}
            expenses={expenses}
            incomes={incomes}
            onAdded={(row) => upsert("budgetCategories", row)}
          />
        )}
      </div>

      {statuses.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-background p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
            Сводка расходов
          </p>
          <EnvelopeBars statuses={statuses} />
        </div>
      )}

      {statuses.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Категории расходов пока не созданы — откройте каталог
        </p>
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

      {incomeCats.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-background p-4">
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
                  onClick={() => removeCategory(c.id)}
                >
                  ×
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
