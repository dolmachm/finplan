"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField, HelpHint } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/ToastProvider";
import { FEATURE_HINTS } from "@/content/help";
import {
  ASSET_CLASS_LABELS,
  ASSET_TYPE_OPTIONS,
  assetTypeLabel,
  essentialLabel,
  FREQUENCY_OPTIONS,
  frequencyLabel,
  INCOME_SOURCE_LABELS,
} from "@/shared/finance-catalog";
import type { Asset, AssetClass, AssetType, Expense, Income } from "@/shared/types";
import { readApiError, parsePositiveNumber } from "@/shared/api-client";
import { formatMoneyInput } from "@/shared/format-input";

const selectClass =
  "w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm";

type EditView = { kind: "asset" | "income" | "expense"; id?: string } | null;

function fmtRub(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n);
}

export function FinanceDataPanel({
  onRefresh,
  onUnauthorized,
  onQuickAdd,
  addingAsset,
}: {
  onRefresh: () => void;
  onUnauthorized: (res: Response) => boolean;
  onQuickAdd: () => void | Promise<void>;
  addingAsset: boolean;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [editView, setEditView] = useState<EditView>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, iRes, eRes] = await Promise.all([
        fetch("/api/assets", { cache: "no-store" }),
        fetch("/api/incomes", { cache: "no-store" }),
        fetch("/api/expenses", { cache: "no-store" }),
      ]);
      if (onUnauthorized(aRes) || onUnauthorized(iRes) || onUnauthorized(eRes)) return;
      if (aRes.ok) setAssets(await aRes.json());
      if (iRes.ok) setIncomes(await iRes.json());
      if (eRes.ok) setExpenses(await eRes.json());
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleQuickAdd() {
    await onQuickAdd();
    await load();
  }

  async function remove(kind: "asset" | "income" | "expense", id: string) {
    try {
      const res = await fetch(`/api/${kind}s/${id}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (onUnauthorized(res)) return;
      if (!res.ok) {
        toast.error("Не удалось удалить");
        return;
      }
      if (kind === "asset") setAssets((prev) => prev.filter((a) => a.id !== id));
      else if (kind === "income") setIncomes((prev) => prev.filter((i) => i.id !== id));
      else setExpenses((prev) => prev.filter((e) => e.id !== id));
      toast.success("Удалено");
      await load();
      await onRefresh();
    } catch {
      toast.error("Не удалось удалить");
    }
  }

  if (editView) {
    return (
      <ItemEditor
        view={editView}
        assets={assets}
        incomes={incomes}
        expenses={expenses}
        onBack={() => setEditView(null)}
        onSaved={async () => {
          setEditView(null);
          await load();
          await onRefresh();
        }}
        onUnauthorized={onUnauthorized}
      />
    );
  }

  return (
    <section className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">Финансовые данные</h2>
            <HelpHint className="mt-1">
              Активы, доходы и расходы. Обязательные — регулярные платежи, переменные — премии, ТО, страховки.
            </HelpHint>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditView({ kind: "asset" })}>
              + Актив
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditView({ kind: "income" })}>
              + Доход
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditView({ kind: "expense" })}>
              + Расход
            </Button>
          </div>
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
            title="Активы"
            empty="Нет активов — добавьте брокерский счёт, недвижимость или другое"
            columns={["Название", "Тип", "Класс", "Стоимость", "Доход/мес"]}
            items={assets.map((a) => ({
              id: a.id,
              cells: [
                a.name,
                assetTypeLabel(a.type),
                ASSET_CLASS_LABELS[(a.assetClass as AssetClass) ?? "PERSONAL"],
                fmtRub(a.currentValue),
                a.dividendIncomeMonthly ? fmtRub(a.dividendIncomeMonthly) : "—",
              ],
            }))}
            onEdit={(id) => setEditView({ kind: "asset", id })}
            onDelete={(id) => remove("asset", id)}
          />
          <DataTable
            title="Доходы"
            empty="Нет доходов"
            columns={["Название", "Источник", "Сумма", "Период", "Тип"]}
            items={incomes.map((i) => ({
              id: i.id,
              cells: [
                i.name,
                INCOME_SOURCE_LABELS[i.source] ?? i.source,
                fmtRub(i.amount),
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
                e.category,
                fmtRub(e.amount),
                frequencyLabel(e.frequency),
                essentialLabel(e.isEssential),
              ],
            }))}
            onEdit={(id) => setEditView({ kind: "expense", id })}
            onDelete={(id) => remove("expense", id)}
          />
        </>
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
    <Card className="overflow-x-auto">
      <h3 className="font-medium">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      ) : (
        <table className="mt-4 w-full text-sm">
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
      )}
    </Card>
  );
}

function ItemEditor({
  view,
  assets,
  incomes,
  expenses,
  onBack,
  onSaved,
  onUnauthorized,
}: {
  view: NonNullable<EditView>;
  assets: Asset[];
  incomes: Income[];
  expenses: Expense[];
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
  const [saving, setSaving] = useState(false);

  function onTypeChange(next: AssetType) {
    setType(next);
    const opt = ASSET_TYPE_OPTIONS.find((o) => o.value === next);
    if (opt) setAssetClass(opt.class);
  }

  async function save() {
    const value = parsePositiveNumber(currentValue, "Стоимость");
    if (!name.trim()) {
      toast.error("Укажите название");
      return;
    }
    if (!value.ok) {
      toast.error(value.message);
      return;
    }
    const rent = dividendIncomeMonthly
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
        expectedReturnPct: Number(expectedReturnPct) || 0,
        volatilityPct: Number(volatilityPct) || 0,
        dividendIncomeMonthly: rent.value,
        maintenanceCostMonthly: maint.value,
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
    <Card>
      <button type="button" onClick={onBack} className="text-sm text-brand hover:underline">
        ← К списку
      </button>
      <h2 className="mt-2 font-medium">{existing ? "Редактирование актива" : "Новый актив"}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
        <FormField label="Класс" htmlFor="asset-class">
          <select id="asset-class" className={selectClass} value={assetClass} onChange={(e) => setAssetClass(e.target.value as AssetClass)}>
            <option value="PERSONAL">Личный</option>
            <option value="INVESTMENT">Инвестиционный</option>
          </select>
        </FormField>
        <FormField label="Текущая стоимость, ₽" htmlFor="asset-value">
          <Input id="asset-value" inputMode="numeric" value={currentValue} onChange={(e) => setCurrentValue(formatMoneyInput(e.target.value))} placeholder="1 000 000" />
        </FormField>
        <FormField label="Доходность, % годовых" htmlFor="asset-return" hint="Ожидаемый рост стоимости">
          <Input id="asset-return" inputMode="decimal" value={expectedReturnPct} onChange={(e) => setExpectedReturnPct(e.target.value)} placeholder="7" />
        </FormField>
        <FormField label="Волатильность, %" htmlFor="asset-vol">
          <Input id="asset-vol" inputMode="decimal" value={volatilityPct} onChange={(e) => setVolatilityPct(e.target.value)} placeholder="12" />
        </FormField>
        <FormField label="Доход в месяц, ₽" htmlFor="asset-rent" hint="Аренда, дивиденды, купоны">
          <Input id="asset-rent" inputMode="numeric" value={dividendIncomeMonthly} onChange={(e) => setDividendIncomeMonthly(formatMoneyInput(e.target.value))} placeholder="30 000" />
        </FormField>
        <FormField label="Содержание в месяц, ₽" htmlFor="asset-maint" hint="Коммуналка, ТО, страховка / 12">
          <Input id="asset-maint" inputMode="numeric" value={maintenanceCostMonthly} onChange={(e) => setMaintenanceCostMonthly(formatMoneyInput(e.target.value))} placeholder="5 000" />
        </FormField>
      </div>
      <div className="mt-6 flex gap-2">
        <Button type="button" onClick={save} disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</Button>
        <Button type="button" variant="secondary" onClick={onBack}>Отмена</Button>
      </div>
    </Card>
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
    <Card>
      <button type="button" onClick={onBack} className="text-sm text-brand hover:underline">← К списку</button>
      <h2 className="mt-2 font-medium">{existing ? "Редактирование дохода" : "Новый доход"}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField label="Название" htmlFor="income-name">
          <Input id="income-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Зарплата / Премия" />
        </FormField>
        <FormField label="Источник" htmlFor="income-source">
          <select id="income-source" className={selectClass} value={source} onChange={(e) => setSource(e.target.value as Income["source"])}>
            {Object.entries(INCOME_SOURCE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
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
      <div className="mt-6 flex gap-2">
        <Button type="button" onClick={save} disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</Button>
        <Button type="button" variant="secondary" onClick={onBack}>Отмена</Button>
      </div>
    </Card>
  );
}

function ExpenseEditor({
  existing,
  onBack,
  onSaved,
  onUnauthorized,
}: {
  existing?: Expense;
  onBack: () => void;
  onSaved: () => void | Promise<void>;
  onUnauthorized: (res: Response) => boolean;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [category, setCategory] = useState(existing?.category ?? "living");
  const [amount, setAmount] = useState(
    existing ? formatMoneyInput(String(existing.amount)) : "",
  );
  const [frequency, setFrequency] = useState(existing?.frequency ?? "MONTHLY");
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
    <Card>
      <button type="button" onClick={onBack} className="text-sm text-brand hover:underline">← К списку</button>
      <h2 className="mt-2 font-medium">{existing ? "Редактирование расхода" : "Новый расход"}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField label="Название" htmlFor="expense-name">
          <Input id="expense-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ипотека / ОСАГО" />
        </FormField>
        <FormField label="Категория" htmlFor="expense-cat">
          <Input id="expense-cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="housing, auto, insurance" />
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
        <FormField label="Тип расхода" htmlFor="expense-kind" hint="Обязательный — аренда; переменный — ТО, страховка раз в год">
          <select id="expense-kind" className={selectClass} value={isEssential ? "1" : "0"} onChange={(e) => setIsEssential(e.target.value === "1")}>
            <option value="1">Обязательный</option>
            <option value="0">Переменный</option>
          </select>
        </FormField>
      </div>
      <div className="mt-6 flex gap-2">
        <Button type="button" onClick={save} disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</Button>
        <Button type="button" variant="secondary" onClick={onBack}>Отмена</Button>
      </div>
    </Card>
  );
}
