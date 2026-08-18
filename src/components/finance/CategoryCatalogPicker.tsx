"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/ToastProvider";
import {
  filterCatalog,
  groupCatalogEntries,
  isCatalogNameAdded,
  popularNotAdded,
  topFrequentCategories,
  type CategoryCatalogEntry,
} from "@/shared/category-catalog";
import type {
  BudgetCategory,
  BudgetCategoryKind,
  Expense,
  Income,
} from "@/shared/types";
import { readApiError } from "@/shared/api-client";
import { apiFetch } from "@/shared/api-fetch";
import { ensureOnlineForWrite } from "@/shared/offline";

export function CategoryCatalogPicker({
  userCategories,
  expenses = [],
  incomes = [],
  onAdded,
}: {
  userCategories: BudgetCategory[];
  expenses?: Expense[];
  incomes?: Income[];
  onAdded: (row: BudgetCategory) => void;
}) {
  const [kind, setKind] = useState<BudgetCategoryKind>("expense");
  const [query, setQuery] = useState("");
  const [customName, setCustomName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const popular = useMemo(
    () => popularNotAdded(kind, userCategories),
    [kind, userCategories],
  );
  const userTop = useMemo(
    () =>
      topFrequentCategories(
        kind,
        userCategories,
        kind === "expense" ? expenses : incomes,
      ),
    [kind, userCategories, expenses, incomes],
  );
  const filtered = useMemo(
    () => filterCatalog(query, kind),
    [query, kind],
  );
  const groups = useMemo(() => groupCatalogEntries(filtered), [filtered]);

  async function addEntry(entry: { name: string; kind: BudgetCategoryKind }, key: string) {
    if (!ensureOnlineForWrite()) return;
    if (isCatalogNameAdded(entry.name, entry.kind, userCategories)) {
      toast.error("Уже в бюджете");
      return;
    }
    setBusyId(key);
    try {
      const res = await apiFetch("/api/budget-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: entry.name.trim(),
          kind: entry.kind,
          monthlyLimit: null,
        }),
      });
      if (!res) return;
      if (!res.ok) {
        const { message } = await readApiError(res);
        toast.error(message);
        return;
      }
      onAdded((await res.json()) as BudgetCategory);
      toast.success(`«${entry.name}» добавлена`);
    } catch {
      toast.error("Не удалось добавить");
    } finally {
      setBusyId(null);
    }
  }

  async function addCustom() {
    if (!customName.trim()) {
      toast.error("Укажите название");
      return;
    }
    await addEntry({ name: customName.trim(), kind }, "__custom__");
    setCustomName("");
  }

  async function addFromCatalog(e: CategoryCatalogEntry) {
    await addEntry(e, e.id);
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={kind === "expense" ? "primary" : "secondary"}
          onClick={() => {
            setKind("expense");
            setQuery("");
          }}
        >
          Расходы
        </Button>
        <Button
          type="button"
          variant={kind === "income" ? "primary" : "secondary"}
          onClick={() => {
            setKind("income");
            setQuery("");
          }}
        >
          Доходы
        </Button>
      </div>

      <FormField label="Поиск по каталогу" htmlFor="cat-search">
        <Input
          id="cat-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Продукты, зарплата, транспорт…"
        />
      </FormField>

      {userTop.length > 0 && !query.trim() && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Ваш топ-5
          </p>
          <div className="flex flex-wrap gap-2">
            {userTop.map((c) => (
              <span
                key={c.id}
                className="rounded-full border border-border bg-card px-3 py-1 text-sm"
              >
                {c.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {popular.length > 0 && !query.trim() && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Часто добавляют
          </p>
          <div className="flex flex-wrap gap-2">
            {popular.map((e) => (
              <Button
                key={e.id}
                type="button"
                variant="secondary"
                disabled={busyId === e.id}
                onClick={() => addFromCatalog(e)}
              >
                {busyId === e.id ? "…" : `+ ${e.name}`}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
        {groups.length === 0 ? (
          <p className="text-sm text-muted">Ничего не найдено</p>
        ) : (
          groups.map(({ group, items }) => (
            <div key={group}>
              <p className="mb-1.5 text-xs font-medium text-muted">{group}</p>
              <ul className="space-y-1">
                {items.map((e) => {
                  const added = isCatalogNameAdded(e.name, e.kind, userCategories);
                  return (
                    <li
                      key={e.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-1.5 text-sm"
                    >
                      <span className={added ? "text-muted" : ""}>{e.name}</span>
                      {added ? (
                        <span className="shrink-0 text-xs text-muted">В бюджете</span>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={busyId === e.id}
                          onClick={() => addFromCatalog(e)}
                        >
                          {busyId === e.id ? "…" : "Добавить"}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
        <FormField
          label="Своя категория"
          htmlFor="cat-custom"
          className="min-w-[12rem] flex-1"
        >
          <Input
            id="cat-custom"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Например, Дети"
            onKeyDown={(ev) => {
              if (ev.key === "Enter") {
                ev.preventDefault();
                void addCustom();
              }
            }}
          />
        </FormField>
        <Button
          type="button"
          variant="secondary"
          disabled={busyId === "__custom__"}
          onClick={() => void addCustom()}
        >
          {busyId === "__custom__" ? "…" : "+ Своя"}
        </Button>
      </div>
    </div>
  );
}
