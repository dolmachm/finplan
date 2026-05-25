"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Disclaimer } from "@/components/Disclaimer";
import { NetWorthChart } from "@/components/charts/NetWorthChart";
import { MonteCarloBandChart } from "@/components/charts/MonteCarloBandChart";
import { ScenariosPanel } from "@/components/scenarios/ScenariosPanel";

type Tab = "plan" | "assets" | "scenarios" | "export";

interface Projection {
  result: {
    monthly: Array<{ month: number; netWorth: number; cashflow: number }>;
    goalFunding: Array<{
      goalId: string;
      requiredMonthlySaving: number;
      projectedBalanceAtTarget: number;
      inflationAdjustedTarget: number;
    }>;
    summary: {
      finalNetWorth: number;
      avgMonthlySurplus: number;
      recommendedMonthlySaving: number;
    };
  };
  scenario: string;
}

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>("plan");
  const [projection, setProjection] = useState<Projection | null>(null);
  const [scenarios, setScenarios] = useState<
    Array<{ id: string; name: string; isActive: boolean; rules: unknown }>
  >([]);
  const [simJob, setSimJob] = useState<{
    id: string;
    status: string;
    progressPct: number;
    result?: {
      goalProbabilities: Array<{
        goalId: string;
        probability: number;
        median: number;
        p5: number;
        p95: number;
      }>;
      samplePaths: Array<{ label: string; netWorth: number[] }>;
    };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProjection = useCallback(async () => {
    const res = await fetch("/api/plan/projection");
    if (res.ok) setProjection(await res.json());
  }, []);

  const loadScenarios = useCallback(async () => {
    const res = await fetch("/api/scenarios");
    if (res.ok) {
      const data = await res.json();
      setScenarios(data.scenarios);
    }
  }, []);

  useEffect(() => {
    Promise.all([loadProjection(), loadScenarios()]).finally(() =>
      setLoading(false),
    );
  }, [loadProjection, loadScenarios]);

  async function runSimulation() {
    const res = await fetch("/api/simulations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numRuns: 5000 }),
    });
    if (!res.ok) return;
    const job = await res.json();
    setSimJob(job);
    pollJob(job.id);
  }

  function pollJob(id: string) {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/simulations/${id}`);
      if (!res.ok) return;
      const job = await res.json();
      setSimJob(job);
      if (job.status === "COMPLETED" || job.status === "FAILED") {
        clearInterval(interval);
        loadProjection();
      }
    }, 2000);
  }

  async function activateScenario(id: string) {
    await fetch(`/api/scenarios/${id}/activate`, { method: "POST" });
    await Promise.all([loadScenarios(), loadProjection()]);
  }

  async function quickAddAsset() {
    await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Портфель",
        type: "BROKERAGE",
        currentValue: 3_000_000,
        expectedReturnPct: 7,
        volatilityPct: 12,
      }),
    });
    await loadProjection();
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "plan", label: "План" },
    { id: "assets", label: "Данные" },
    { id: "scenarios", label: "Сценарии" },
    { id: "export", label: "Экспорт" },
  ];

  return (
    <div className="min-h-full bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-xl font-semibold text-emerald-800">FinPlan</h1>
          <nav className="flex gap-4 text-sm">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={
                  tab === t.id
                    ? "font-medium text-emerald-700"
                    : "text-zinc-600 hover:text-zinc-900"
                }
              >
                {t.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-zinc-500"
            >
              Выйти
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Disclaimer className="mb-6" />

        {loading && <p className="text-zinc-500">Загрузка…</p>}

        {tab === "plan" && projection && (
          <div className="space-y-8">
            <section className="grid gap-4 sm:grid-cols-3">
              <SummaryCard
                title="Рекомендуемый взнос / мес"
                value={projection.result.summary.recommendedMonthlySaving}
              />
              <SummaryCard
                title="Средний профицит / мес"
                value={projection.result.summary.avgMonthlySurplus}
              />
              <SummaryCard
                title="Чистые активы (конец горизонта)"
                value={projection.result.summary.finalNetWorth}
              />
            </section>

            <section className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="font-medium">
                Timeline — сценарий «{projection.scenario}»
              </h2>
              <NetWorthChart data={projection.result.monthly} />
            </section>

            {simJob?.result && (
              <section className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="font-medium">Monte Carlo</h2>
                <MonteCarloBandChart paths={simJob.result.samplePaths} />
                <ul className="mt-4 space-y-2 text-sm">
                  {simJob.result.goalProbabilities.map((g) => (
                    <li key={g.goalId}>
                      Цель: вероятность {(g.probability * 100).toFixed(1)}%,
                      медиана {formatRub(g.median)}, 5%: {formatRub(g.p5)},
                      95%: {formatRub(g.p95)}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={runSimulation}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white"
              >
                Запустить Monte Carlo (5k)
              </button>
              {simJob && (
                <span className="text-sm text-zinc-600">
                  Статус: {simJob.status} ({simJob.progressPct}%)
                </span>
              )}
            </div>
          </div>
        )}

        {tab === "assets" && (
          <OnboardingPanel onQuickAdd={quickAddAsset} onRefresh={loadProjection} />
        )}

        {tab === "scenarios" && (
          <ScenariosPanel
            scenarios={scenarios}
            onRefresh={loadScenarios}
            onActivate={activateScenario}
          />
        )}

        {tab === "export" && (
          <section className="rounded-xl border bg-white p-6 space-y-4">
            <h2 className="font-medium">Экспорт</h2>
            <a
              href="/api/export/pdf"
              className="inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white"
            >
              Скачать PDF
            </a>
            <CsvImport />
          </section>
        )}
      </main>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-xs text-zinc-500">{title}</p>
      <p className="mt-1 text-lg font-semibold">{formatRub(value)}</p>
    </div>
  );
}

function formatRub(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n);
}

function OnboardingPanel({
  onQuickAdd,
  onRefresh,
}: {
  onQuickAdd: () => void;
  onRefresh: () => void;
}) {
  const [income, setIncome] = useState("50000");
  const [expense, setExpense] = useState("40000");

  async function saveBasics() {
    await fetch("/api/incomes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Зарплата",
        source: "SALARY",
        amount: Number(income),
      }),
    });
    await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Расходы",
        category: "living",
        amount: Number(expense),
      }),
    });
    await onRefresh();
  }

  return (
    <section className="space-y-6">
      <div className="rounded-xl border bg-white p-6">
        <h2 className="font-medium">Быстрый старт</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Шаг 1: доход и расход. Шаг 2: активы. Шаг 3: цель и Monte Carlo.
        </p>
        <div className="mt-4 flex gap-4">
          <input
            className="rounded border px-3 py-2 text-sm"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
            placeholder="Доход / мес"
          />
          <input
            className="rounded border px-3 py-2 text-sm"
            value={expense}
            onChange={(e) => setExpense(e.target.value)}
            placeholder="Расход / мес"
          />
          <button
            type="button"
            onClick={saveBasics}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white"
          >
            Сохранить
          </button>
        </div>
        <button
          type="button"
          onClick={onQuickAdd}
          className="mt-4 text-sm text-emerald-700 underline"
        >
          Добавить демо-портфель 3 млн ₽
        </button>
      </div>
      <GoalForm onSaved={onRefresh} />
    </section>
  );
}

function GoalForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("Квартира");
  const [amount, setAmount] = useState("6000000");
  const [years, setYears] = useState("7");

  async function submit() {
    const targetDate = new Date();
    targetDate.setFullYear(targetDate.getFullYear() + Number(years));
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        targetAmountNominal: Number(amount),
        targetDate: targetDate.toISOString(),
      }),
    });
    await onSaved();
  }

  return (
    <div className="rounded-xl border bg-white p-6">
      <h3 className="font-medium">Цель</h3>
      <div className="mt-4 flex flex-wrap gap-3">
        <input
          className="rounded border px-3 py-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="rounded border px-3 py-2 text-sm"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          className="w-20 rounded border px-3 py-2 text-sm"
          value={years}
          onChange={(e) => setYears(e.target.value)}
          title="лет"
        />
        <button
          type="button"
          onClick={submit}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white"
        >
          Добавить цель
        </button>
      </div>
    </div>
  );
}

function CsvImport() {
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    await fetch("/api/import/csv", { method: "POST", body: fd });
    alert("Импорт завершён");
  }
  return (
    <div>
      <p className="text-sm text-zinc-600 mb-2">
        CSV: колонки type (asset|income|expense), name, amount, category
      </p>
      <input type="file" accept=".csv" onChange={onFile} className="text-sm" />
    </div>
  );
}
