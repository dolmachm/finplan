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
import { FormError } from "@/components/ui/FormError";
import { FormField, HelpHint } from "@/components/ui/FormField";
import { toast } from "@/components/ui/ToastProvider";
import { FEATURE_HINTS } from "@/content/help";
import {
  issuesByField,
  parsePositiveNumber,
  readApiError,
} from "@/shared/api-client";
import { digitsOnly, formatMoneyInput } from "@/shared/format-input";

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
  const [simStarting, setSimStarting] = useState(false);
  const [addingAsset, setAddingAsset] = useState(false);

  const simBusy =
    simStarting ||
    simJob?.status === "PENDING" ||
    simJob?.status === "RUNNING";

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
    setSimStarting(true);
    try {
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
    } catch {
      const message = "Не удалось запустить расчёт. Проверьте подключение и попробуйте снова.";
      setSimError(message);
      toast.error(message);
    } finally {
      setSimStarting(false);
    }
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
    setAddingAsset(true);
    try {
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
    } catch {
      toast.error("Не удалось добавить портфель. Проверьте подключение и попробуйте снова.");
    } finally {
      setAddingAsset(false);
    }
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
                hint="Сколько откладывать ежемесячно, чтобы успеть к целям"
                value={projection.result.summary.recommendedMonthlySaving}
              />
              <SummaryCard
                title="Средний профицит / мес"
                hint="Доходы минус расходы и долги в среднем за горизонт"
                value={projection.result.summary.avgMonthlySurplus}
              />
              <SummaryCard
                title="Чистые активы (конец горизонта)"
                hint="Прогноз накоплений к концу выбранного периода"
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

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <HelpHint>{FEATURE_HINTS.monteCarlo}</HelpHint>
              </div>
              <Button type="button" onClick={runSimulation} disabled={simBusy}>
                {simBusy ? "Расчёт…" : "Запустить Monte Carlo (5k)"}
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
            addingAsset={addingAsset}
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
          <Card className="space-y-6">
            <div>
              <h2 className="font-medium">PDF-отчёт</h2>
              <HelpHint className="mt-1">{FEATURE_HINTS.pdfExport}</HelpHint>
              <a
                href="/api/export/pdf"
                className="mt-3 inline-block rounded-lg bg-sidebar px-4 py-2 text-sm text-white hover:opacity-90"
              >
                Скачать PDF
              </a>
            </div>
            <CsvImport />
          </Card>
        )}
    </DashboardShell>
  );
}

function SummaryCard({
  title,
  hint,
  value,
}: {
  title: string;
  hint?: string;
  value: number;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{title}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted/80">{hint}</p>}
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
  addingAsset,
}: {
  onQuickAdd: () => void;
  onRefresh: () => void;
  onUnauthorized: (res: Response) => boolean;
  addingAsset: boolean;
}) {
  const [income, setIncome] = useState("50 000");
  const [expense, setExpense] = useState("40 000");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const incomeValid = parsePositiveNumber(income, "Доход").ok;
  const expenseValid = parsePositiveNumber(expense, "Расход").ok;
  const canSave = incomeValid && expenseValid && !saving;

  async function saveBasics() {
    setError("");
    setFieldErrors({});

    const incomeNum = parsePositiveNumber(income, "Доход");
    if (!incomeNum.ok) {
      setFieldErrors({ amount: incomeNum.message });
      toast.error(incomeNum.message);
      return;
    }
    const expenseNum = parsePositiveNumber(expense, "Расход");
    if (!expenseNum.ok) {
      setFieldErrors({ category: expenseNum.message });
      toast.error(expenseNum.message);
      return;
    }

    setSaving(true);
    try {
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
    } catch {
      const message = "Не удалось сохранить данные. Проверьте подключение и попробуйте снова.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <Card>
        <h2 className="font-medium">Быстрый старт</h2>
        <p className="mt-1 text-sm text-muted">
          Шаг 1: доход и расход. Шаг 2: активы. Шаг 3: цель и Monte Carlo.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <FormField
            label="Доход в месяц"
            hint="Зарплата и другие поступления после налогов"
            htmlFor="income"
            error={fieldErrors.amount}
            className="max-w-[180px]"
          >
            <Input
              id="income"
              inputMode="numeric"
              value={income}
              onChange={(e) => setIncome(formatMoneyInput(e.target.value))}
              placeholder="50 000"
            />
          </FormField>
          <FormField
            label="Расход в месяц"
            hint="Обязательные и регулярные траты"
            htmlFor="expense"
            error={fieldErrors.category}
            className="max-w-[180px]"
          >
            <Input
              id="expense"
              inputMode="numeric"
              value={expense}
              onChange={(e) => setExpense(formatMoneyInput(e.target.value))}
              placeholder="40 000"
            />
          </FormField>
          <Button type="button" onClick={saveBasics} disabled={!canSave}>
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        </div>
        <FormError message={error} />
        <div className="mt-4">
          <HelpHint>{FEATURE_HINTS.demoPortfolio}</HelpHint>
          <button
          type="button"
          onClick={onQuickAdd}
          disabled={addingAsset}
          className="mt-4 text-sm font-medium text-brand hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          {addingAsset ? "Добавление…" : "Добавить демо-портфель 3 млн ₽"}
        </button>
        </div>
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
  const [amount, setAmount] = useState("6 000 000");
  const [years, setYears] = useState("7");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const amountNum = parsePositiveNumber(amount, "Целевая сумма");
  const yearsNum = parsePositiveNumber(years, "Срок");
  const canSubmit =
    name.trim().length > 0 &&
    amountNum.ok &&
    amountNum.value > 0 &&
    yearsNum.ok &&
    yearsNum.value > 0 &&
    !saving;

  async function submit() {
    setError("");
    setFieldErrors({});

    if (!name.trim()) {
      const message = "Название: укажите цель. Например, «Квартира»";
      setFieldErrors({ name: message });
      toast.error(message);
      return;
    }

    if (!amountNum.ok) {
      setFieldErrors({ targetAmountNominal: amountNum.message });
      toast.error(amountNum.message);
      return;
    }
    if (amountNum.value === 0) {
      const message = "Целевая сумма должна быть больше нуля";
      setFieldErrors({ targetAmountNominal: message });
      toast.error(message);
      return;
    }

    if (!yearsNum.ok || yearsNum.value === 0) {
      const message = "Срок: укажите число лет, например 7";
      setFieldErrors({ targetDate: message });
      toast.error(message);
      return;
    }

    const targetDate = new Date();
    targetDate.setFullYear(targetDate.getFullYear() + yearsNum.value);

    setSaving(true);
    try {
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
    } catch {
      const message = "Не удалось добавить цель. Проверьте подключение и попробуйте снова.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h3 className="font-medium">Цель</h3>
      <HelpHint className="mt-1">
        Укажите название, сумму в рублях и срок в годах — дата цели рассчитается автоматически.
      </HelpHint>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <FormField
          label="Название"
          htmlFor="goal-name"
          error={fieldErrors.name}
          className="max-w-[160px]"
        >
          <Input
            id="goal-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Квартира"
          />
        </FormField>
        <FormField
          label="Сумма, ₽"
          hint="Номинальная сумма без инфляции"
          htmlFor="goal-amount"
          error={fieldErrors.targetAmountNominal}
          className="max-w-[160px]"
        >
          <Input
            id="goal-amount"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(formatMoneyInput(e.target.value))}
            placeholder="6 000 000"
          />
        </FormField>
        <FormField
          label="Срок, лет"
          htmlFor="goal-years"
          error={fieldErrors.targetDate}
          className="w-28"
        >
          <Input
            id="goal-years"
            inputMode="numeric"
            value={years}
            onChange={(e) => setYears(digitsOnly(e.target.value, 2))}
            placeholder="7"
          />
        </FormField>
        <Button type="button" onClick={submit} disabled={!canSubmit}>
          {saving ? "Добавление…" : "Добавить цель"}
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
      <h3 className="font-medium">Импорт CSV</h3>
      <HelpHint className="mt-1">{FEATURE_HINTS.csvImport}</HelpHint>
      <p className="mt-2 text-xs text-muted">
        Колонки: type (asset|income|expense), name, amount, category
      </p>
      <input type="file" accept=".csv" onChange={onFile} className="mt-3 text-sm" />
      {result && <p className="mt-2 text-sm text-success">{result}</p>}
      <FormError message={error} />
    </div>
  );
}
