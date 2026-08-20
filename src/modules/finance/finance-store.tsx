"use client";

/**
 * Клиентский стор финансов: сначала лёгкий summary (Home), затем полный
 * snapshot по требованию вкладок. Мутации мержат ответ API локально.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiFetchJson } from "@/shared/api-fetch";
import type { FinanceSnapshot } from "@/modules/finance/finance-snapshot";
import {
  buildFinanceSummaryFromSnapshot,
  type FinanceSummary,
  type MonthActualsSnippet,
} from "@/modules/finance/finance-summary";
import type { HomeDashboardInput } from "@/modules/dashboard/insights";
import {
  scoreFromHomeInput,
  type FinancialScore,
} from "@/modules/dashboard/scoring";
import type {
  Asset,
  BudgetCategory,
  Expense,
  Goal,
  Income,
  Liability,
  MacroSettings,
  Scenario,
} from "@/shared/types";

type EntityKey =
  | "assets"
  | "liabilities"
  | "incomes"
  | "expenses"
  | "goals"
  | "budgetCategories"
  | "scenarios";

type EntityMap = {
  assets: Asset;
  liabilities: Liability;
  incomes: Income;
  expenses: Expense;
  goals: Goal;
  budgetCategories: BudgetCategory;
  scenarios: Scenario;
};

/** Доп. поля скора с projection / Monte Carlo (не хранятся в snapshot). */
export type FinanceEnrichment = {
  recommendedMonthlySaving?: number;
  goalProbabilities?: Array<{ probability: number }>;
  projectionCashflowAvg?: number | null;
};

type FinanceStoreValue = {
  summaryLoading: boolean;
  entitiesLoading: boolean;
  error: string | null;
  summaryReady: boolean;
  entitiesReady: boolean;
  summary: FinanceSummary | null;
  assets: Asset[];
  liabilities: Liability[];
  incomes: Income[];
  expenses: Expense[];
  goals: Goal[];
  budgetCategories: BudgetCategory[];
  scenarios: Scenario[];
  macro: MacroSettings | null;
  homeInput: HomeDashboardInput | null;
  score: FinancialScore | null;
  enrichment: FinanceEnrichment;
  loadSummary: () => Promise<void>;
  ensureSnapshot: () => Promise<void>;
  refresh: () => Promise<void>;
  setMacro: (macro: MacroSettings | null) => void;
  setScenarios: (scenarios: Scenario[]) => void;
  upsert: <K extends EntityKey>(key: K, entity: EntityMap[K]) => void;
  remove: (key: EntityKey, id: string) => void;
  setEnrichment: (patch: Partial<FinanceEnrichment>) => void;
  entitiesRevision: number;
};

const FinanceStoreContext = createContext<FinanceStoreValue | null>(null);

function upsertInList<T extends { id: string }>(list: T[], entity: T): T[] {
  const idx = list.findIndex((x) => x.id === entity.id);
  if (idx === -1) return [...list, entity];
  const next = list.slice();
  next[idx] = entity;
  return next;
}

function removeFromList<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((x) => x.id !== id);
}

export function FinanceStoreProvider({ children }: { children: ReactNode }) {
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [entitiesLoading, setEntitiesLoading] = useState(false);
  const [summaryReady, setSummaryReady] = useState(false);
  const [entitiesReady, setEntitiesReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>(
    [],
  );
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [macro, setMacroState] = useState<MacroSettings | null>(null);
  const [enrichment, setEnrichmentState] = useState<FinanceEnrichment>({});
  const [entitiesRevision, setEntitiesRevision] = useState(0);
  const bumpRevision = useCallback(() => {
    setEntitiesRevision((n) => n + 1);
  }, []);
  // Ref нужен: ensureSnapshot в stale closure не должен снова бить API после refresh.
  const snapshotInflight = useRef<Promise<void> | null>(null);
  const entitiesReadyRef = useRef(false);
  const enrichmentRef = useRef(enrichment);
  const monthActualsRef = useRef<MonthActualsSnippet | null>(null);
  const actualByCatRef = useRef<Map<string, number>>(new Map());

  function rememberMonthFromSummary(s: FinanceSummary) {
    monthActualsRef.current = s.monthActuals;
    const map = new Map<string, number>();
    for (const e of s.metrics.envelopes) {
      if (e.actualMonthly != null) map.set(e.categoryId, e.actualMonthly);
    }
    if (map.size > 0) actualByCatRef.current = map;
  }

  function summaryExtras(base?: FinanceEnrichment) {
    return {
      ...(base ?? enrichmentRef.current),
      previousMonthActuals: monthActualsRef.current,
      previousActualByCategory: actualByCatRef.current,
    };
  }

  useEffect(() => {
    enrichmentRef.current = enrichment;
  }, [enrichment]);

  const applySnapshot = useCallback((snap: FinanceSnapshot) => {
    setAssets(snap.assets);
    setLiabilities(snap.liabilities);
    setIncomes(snap.incomes);
    setExpenses(snap.expenses);
    setGoals(snap.goals);
    setBudgetCategories(snap.budgetCategories);
    setScenarios(snap.scenarios);
    setMacroState(snap.macro);
    bumpRevision();
  }, [bumpRevision]);

  /** Первый запрос dashboard: только цифры для Home. */
  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setError(null);
    const result = await apiFetchJson<FinanceSummary>("/api/finance/summary");
    if (!result.ok) {
      if (result.res !== null) setError(result.message);
      setSummaryLoading(false);
      setSummaryReady(true);
      return;
    }
    setSummary(result.data);
    rememberMonthFromSummary(result.data);
    setSummaryReady(true);
    setSummaryLoading(false);
  }, []);

  /**
   * Идемпотентная подгрузка полных сущностей (Данные/План/Цели).
   * Параллельные вызовы ждут один inflight-promise.
   */
  const ensureSnapshot = useCallback(async () => {
    if (entitiesReadyRef.current) return;
    if (snapshotInflight.current) return snapshotInflight.current;

    const run = (async () => {
      setEntitiesLoading(true);
      setError(null);
      const result = await apiFetchJson<FinanceSnapshot>(
        "/api/finance/snapshot",
      );
      if (!result.ok) {
        if (result.res !== null) setError(result.message);
        setEntitiesLoading(false);
        return;
      }
      applySnapshot(result.data);
      const next = buildFinanceSummaryFromSnapshot(
        result.data,
        summaryExtras(),
      );
      setSummary(next);
      rememberMonthFromSummary(next);
      setSummaryReady(true);
      entitiesReadyRef.current = true;
      setEntitiesReady(true);
      setEntitiesLoading(false);
    })().finally(() => {
      snapshotInflight.current = null;
    });

    snapshotInflight.current = run;
    return run;
  }, [applySnapshot]);

  /** После CSV-импорта и т.п.: сброс кэша сущностей + summary + snapshot. */
  const refresh = useCallback(async () => {
    entitiesReadyRef.current = false;
    setEntitiesReady(false);
    snapshotInflight.current = null;
    await loadSummary();
    await ensureSnapshot();
  }, [loadSummary, ensureSnapshot]);

  // Локальный upsert/remove → пересчитать цифры без повторного HTTP summary.
  useEffect(() => {
    if (!entitiesReady) return;
    const next = buildFinanceSummaryFromSnapshot(
      {
        assets,
        liabilities,
        incomes,
        expenses,
        goals,
        budgetCategories,
        scenarios,
        macro,
      },
      summaryExtras(enrichment),
    );
    setSummary(next);
    rememberMonthFromSummary(next);
  }, [
    entitiesReady,
    assets,
    liabilities,
    incomes,
    expenses,
    goals,
    budgetCategories,
    scenarios,
    macro,
    enrichment,
  ]);

  const setEnrichment = useCallback((patch: Partial<FinanceEnrichment>) => {
    setEnrichmentState((prev) => ({ ...prev, ...patch }));
  }, []);

  const upsert = useCallback(
    <K extends EntityKey>(key: K, entity: EntityMap[K]) => {
      switch (key) {
        case "assets":
          setAssets((prev) => upsertInList(prev, entity as Asset));
          break;
        case "liabilities":
          setLiabilities((prev) => upsertInList(prev, entity as Liability));
          break;
        case "incomes":
          setIncomes((prev) => upsertInList(prev, entity as Income));
          break;
        case "expenses":
          setExpenses((prev) => upsertInList(prev, entity as Expense));
          break;
        case "goals":
          setGoals((prev) => upsertInList(prev, entity as Goal));
          break;
        case "budgetCategories":
          setBudgetCategories((prev) =>
            upsertInList(prev, entity as BudgetCategory),
          );
          break;
        case "scenarios":
          setScenarios((prev) => upsertInList(prev, entity as Scenario));
          break;
      }
      bumpRevision();
    },
    [bumpRevision],
  );

  const remove = useCallback((key: EntityKey, id: string) => {
    switch (key) {
      case "assets":
        setAssets((prev) => removeFromList(prev, id));
        break;
      case "liabilities":
        setLiabilities((prev) => removeFromList(prev, id));
        break;
      case "incomes":
        setIncomes((prev) => removeFromList(prev, id));
        break;
      case "expenses":
        setExpenses((prev) => removeFromList(prev, id));
        break;
      case "goals":
        setGoals((prev) => removeFromList(prev, id));
        break;
      case "budgetCategories":
        setBudgetCategories((prev) => removeFromList(prev, id));
        break;
      case "scenarios":
        setScenarios((prev) => removeFromList(prev, id));
        break;
    }
    bumpRevision();
  }, [bumpRevision]);

  const homeInput: HomeDashboardInput | null = useMemo(() => {
    if (!entitiesReady) return null;
    return {
      assets,
      liabilities,
      incomes,
      expenses,
      goals,
      scenarioCount: scenarios.length,
      budgetCategories,
      recommendedMonthlySaving: enrichment.recommendedMonthlySaving,
      goalProbabilities: enrichment.goalProbabilities,
    };
  }, [
    entitiesReady,
    assets,
    liabilities,
    incomes,
    expenses,
    goals,
    scenarios.length,
    budgetCategories,
    enrichment.recommendedMonthlySaving,
    enrichment.goalProbabilities,
  ]);

  const scoreFromEntities = useMemo(() => {
    if (!homeInput) return null;
    return scoreFromHomeInput(homeInput, {
      projectionCashflowAvg: enrichment.projectionCashflowAvg,
    });
  }, [homeInput, enrichment.projectionCashflowAvg]);

  // Пока сущности не загружены — скор из summary; иначе пересчёт из списков.
  const score = scoreFromEntities ?? summary?.score ?? null;

  const setMacro = useCallback(
    (next: MacroSettings | null) => {
      setMacroState(next);
      bumpRevision();
    },
    [bumpRevision],
  );

  const value = useMemo<FinanceStoreValue>(
    () => ({
      summaryLoading,
      entitiesLoading,
      error,
      summaryReady,
      entitiesReady,
      summary,
      assets,
      liabilities,
      incomes,
      expenses,
      goals,
      budgetCategories,
      scenarios,
      macro,
      homeInput,
      score,
      enrichment,
      entitiesRevision,
      loadSummary,
      ensureSnapshot,
      refresh,
      setMacro,
      setScenarios,
      upsert,
      remove,
      setEnrichment,
    }),
    [
      summaryLoading,
      entitiesLoading,
      error,
      summaryReady,
      entitiesReady,
      summary,
      assets,
      liabilities,
      incomes,
      expenses,
      goals,
      budgetCategories,
      scenarios,
      macro,
      homeInput,
      score,
      enrichment,
      entitiesRevision,
      loadSummary,
      ensureSnapshot,
      refresh,
      setMacro,
      upsert,
      remove,
      setEnrichment,
    ],
  );

  return (
    <FinanceStoreContext.Provider value={value}>
      {children}
    </FinanceStoreContext.Provider>
  );
}

/** Доступ к FinanceStoreProvider; без провайдера — явная ошибка. */
export function useFinanceStore(): FinanceStoreValue {
  const ctx = useContext(FinanceStoreContext);
  if (!ctx) {
    throw new Error("useFinanceStore must be used within FinanceStoreProvider");
  }
  return ctx;
}
