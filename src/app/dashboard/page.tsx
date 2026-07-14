"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Disclaimer } from "@/components/Disclaimer";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NetWorthChart } from "@/components/charts/NetWorthChart";
import { MonteCarloBandChart } from "@/components/charts/MonteCarloBandChart";
import { ScenariosPanel } from "@/components/scenarios/ScenariosPanel";
import { FieldError, FormError } from "@/components/ui/FormError";
import { toast } from "@/components/ui/ToastProvider";
import {
  issuesByField,
  parsePositiveNumber,
  readApiError,
} from "@/shared/api-client";

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
  const router = useRouter();
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
  const [simError, setSimError] = useState("");

  const handleUnauthorized = useCallback(
    (res: Response) => {
      if (res.status === 401) {
        router.push("/login?session=expired");
        return true;
      }
      return false;
    },
    [router],
  );

  const loadProjection = useCallback(async () => {
    const res = await fetch("/api/plan/projection");
    if (handleUnauthorized(res)) return;
    if (res.ok) setProjection(await res.json());
  }, [handleUnauthorized]);

  const loadScenarios = useCallback(async () => {
    const res = await fetch("/api/scenarios");
    if (handleUnauthorized(res)) return;
    if (res.ok) {
      const data = await res.json();
      setScenarios(data.scenarios);
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    Promise.all([loadProjection(), loadScenarios()]).finally(() =>
      setLoading(false),
    );
  }, [loadProjection, loadScenarios]);

  async function runSimulation() {
    setSimError("");
    const res = await fetch("/api/simulations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numRuns: 5000 }),
    });
    if (handleUnauthorized(res)) return;
    if (!res.ok) {
      const { message } = await readApiError(res);
      setSimError(message);
      toast.error(message);
      return;
    }
    const job = await res.json();
    setSimJob(job);
    toast.success("Расчёт Monte Carlo запущен");
    pollJob(job.id);
  }

  function pollJob(id: string) {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/simulations/${id}`);
      if (!res.ok) return;
      const job = await res.json();
      setSimJob(job);
      if (job.status === "COMPLETED") {
        clearInterval(interval);
        loadProjection();
        toast.success("Расчёт Monte Carlo завершён");
      }
      if (job.status === "FAILED") {
        clearInterval(interval);
        const message =
          job.errorMessage ??
          "Расчёт завершился с ошибкой. Проверьте данные плана и попробуйте снова";
        setSimError(message);
        toast.error(message);
      }
    }, 2000);
  }

  async function activateScenario(id: string) {
    const res = await fetch(`/api/scenarios/${id}/activate`, { method: "POST" });
    if (handleUnauthorized(res)) return;
    if (!res.ok) {
      const { message } = await readApiError(res);
      setSimError(message);
      toast.error(message);
      return;
    }
    await Promise.all([loadScenarios(), loadProjection()]);
    toast.success("Сценарий применён");
  }

  async function quickAddAsset() {
    const res = await fetch("/api/assets", {
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
    if (handleUnauthorized(res)) return;
    if (!res.ok) {
      const { message } = await readApiError(res);
      toast.error(message);
      return;
    }
    await loadProjection();
    toast.success("Демо-портфель добавлен");
  }

  return (
    <DashboardShell tab={tab} onTabChange={setTab}>
      <Disclaimer className="mb-6" />

      {loading && <p className="text-muted">Загрузка…</p>}

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

            <Card>
              <h2 className="font-medium">
                Timeline — сценарий «{projection.scenario}»
              </h2>
              <NetWorthChart data={projection.result.monthly} />
            </Card>

            {simJob?.result && (
              <Card>
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
              </Card>
            )}

            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={runSimulation}>
                Запустить Monte Carlo (5k)
              </Button>
              {simJob && (
                <span className="text-sm text-muted">
                  Статус: {simJob.status} ({simJob.progressPct}%)
                </span>
              )}
            </div>
            <FormError message={simError} />
          </div>
        )}

        {tab === "assets" && (
          <OnboardingPanel
            onQuickAdd={quickAddAsset}
            onRefresh={loadProjection}
            onUnauthorized={handleUnauthorized}
          />
        )}

        {tab === "scenarios" && (
          <ScenariosPanel
            scenarios={scenarios}
            onRefresh={loadScenarios}
            onActivate={activateScenario}
          />
        )}

        {tab === "export" && (
          <Card className="space-y-4">
            <h2 className="font-medium">Экспорт</h2>
            <a
              href="/api/export/pdf"
              className="inline-block rounded-lg bg-sidebar px-4 py-2 text-sm text-white hover:opacity-90"
            >
              Скачать PDF
            </a>
            <CsvImport />
          </Card>
        )}
    </DashboardShell>
  );
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{title}</p>
      <p className="mt-1 text-lg font-semibold">{formatRub(value)}</p>
    </Card>
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
  onUnauthorized,
}: {
  onQuickAdd: () => void;
  onRefresh: () => void;
  onUnauthorized: (res: Response) => boolean;
}) {
  const [income, setIncome] = useState("50000");
  const [expense, setExpense] = useState("40000");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function saveBasics() {
    setError("");
    setFieldErrors({});

    const incomeNum = parsePositiveNumber(income, "Доход");
    if (!incomeNum.ok) {
      setFieldErrors({ amount: incomeNum.message });
      return;
    }
    const expenseNum = parsePositiveNumber(expense, "Расход");
    if (!expenseNum.ok) {
      setFieldErrors({ category: expenseNum.message });
      return;
    }

    const incomeRes = await fetch("/api/incomes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Зарплата",
        source: "SALARY",
        amount: incomeNum.value,
      }),
    });
    if (onUnauthorized(incomeRes)) return;
    if (!incomeRes.ok) {
      const { message, issues } = await readApiError(incomeRes);
      setError(message);
      setFieldErrors(issuesByField(issues));
      toast.error(message);
      return;
    }

    const expenseRes = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Расходы",
        category: "living",
        amount: expenseNum.value,
      }),
    });
    if (onUnauthorized(expenseRes)) return;
    if (!expenseRes.ok) {
      const { message, issues } = await readApiError(expenseRes);
      setError(message);
      setFieldErrors(issuesByField(issues));
      toast.error(message);
      return;
    }

    await onRefresh();
    toast.success("Доход и расход сохранены");
  }

  return (
    <section className="space-y-6">
      <Card>
        <h2 className="font-medium">Быстрый старт</h2>
        <p className="mt-1 text-sm text-muted">
          Шаг 1: доход и расход. Шаг 2: активы. Шаг 3: цель и Monte Carlo.
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <div>
            <Input
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              placeholder="Доход / мес"
              className="max-w-[160px]"
            />
            <FieldError message={fieldErrors.amount} />
          </div>
          <div>
            <Input
              value={expense}
              onChange={(e) => setExpense(e.target.value)}
              placeholder="Расход / мес"
              className="max-w-[160px]"
            />
            <FieldError message={fieldErrors.category} />
          </div>
          <Button type="button" onClick={saveBasics}>
            Сохранить
          </Button>
        </div>
        <FormError message={error} />
        <button
          type="button"
          onClick={onQuickAdd}
          className="mt-4 text-sm font-medium text-brand hover:underline"
        >
          Добавить демо-портфель 3 млн ₽
        </button>
      </Card>
      <GoalForm onSaved={onRefresh} onUnauthorized={onUnauthorized} />
    </section>
  );
}

function GoalForm({
  onSaved,
  onUnauthorized,
}: {
  onSaved: () => void;
  onUnauthorized: (res: Response) => boolean;
}) {
  const [name, setName] = useState("Квартира");
  const [amount, setAmount] = useState("6000000");
  const [years, setYears] = useState("7");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit() {
    setError("");
    setFieldErrors({});

    if (!name.trim()) {
      setFieldErrors({ name: "Название: укажите цель. Например, «Квартира»" });
      return;
    }

    const amountNum = parsePositiveNumber(amount, "Целевая сумма");
    if (!amountNum.ok) {
      setFieldErrors({ targetAmountNominal: amountNum.message });
      return;
    }
    if (amountNum.value === 0) {
      setFieldErrors({
        targetAmountNominal: "Целевая сумма должна быть больше нуля",
      });
      return;
    }

    const yearsNum = parsePositiveNumber(years, "Срок");
    if (!yearsNum.ok || yearsNum.value === 0) {
      setFieldErrors({
        targetDate: "Срок: укажите число лет, например 7",
      });
      return;
    }

    const targetDate = new Date();
    targetDate.setFullYear(targetDate.getFullYear() + yearsNum.value);

    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        targetAmountNominal: amountNum.value,
        targetDate: targetDate.toISOString(),
      }),
    });
    if (onUnauthorized(res)) return;
    if (!res.ok) {
      const { message, issues } = await readApiError(res);
      setError(message);
      setFieldErrors(issuesByField(issues));
      toast.error(message);
      return;
    }

    await onSaved();
    toast.success("Цель добавлена");
  }

  return (
    <Card>
      <h3 className="font-medium">Цель</h3>
      <div className="mt-4 flex flex-wrap gap-3">
        <div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-[140px]"
          />
          <FieldError message={fieldErrors.name} />
        </div>
        <div>
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="max-w-[140px]"
          />
          <FieldError message={fieldErrors.targetAmountNominal} />
        </div>
        <div>
          <Input
            value={years}
            onChange={(e) => setYears(e.target.value)}
            title="лет"
            className="w-20"
          />
          <FieldError message={fieldErrors.targetDate} />
        </div>
        <Button type="button" onClick={submit}>
          Добавить цель
        </Button>
      </div>
      <FormError message={error} />
    </Card>
  );
}

function CsvImport() {
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult("");
    setError("");

    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/import/csv", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const fix = data.fix ? ` ${data.fix}` : "";
      const message = (data.error ?? "Ошибка импорта") + fix;
      setError(message);
      toast.error(message);
      return;
    }

    const lines = [
      `Импортировано: ${data.created} из ${data.total}`,
      data.skipped ? `Пропущено: ${data.skipped}` : "",
    ].filter(Boolean);

    if (data.errors?.length) {
      const details = data.errors
        .slice(0, 5)
        .map(
          (err: { row: number; message: string; fix: string }) =>
            `Строка ${err.row}: ${err.message}. ${err.fix}`,
        )
        .join(" ");
      lines.push(details);
      if (data.errors.length > 5) {
        lines.push(`…и ещё ${data.errors.length - 5} ошибок`);
      }
    }

    const message = lines.join(". ");
    setResult(message);
    toast.success(`Импортировано: ${data.created} из ${data.total}`);
    e.target.value = "";
  }

  return (
    <div>
      <p className="mb-2 text-sm text-muted">
        CSV: колонки type (asset|income|expense), name, amount, category
      </p>
      <input type="file" accept=".csv" onChange={onFile} className="text-sm" />
      {result && <p className="mt-2 text-sm text-success">{result}</p>}
      <FormError message={error} />
    </div>
  );
}
