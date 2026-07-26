"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { FormField, HelpHint } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { FEATURE_HINTS } from "@/content/help";
import { amortizeLoan } from "@/modules/finance/loan-math";
import { normalizePathSettings } from "@/modules/plan/goal-paths";
import { formatMoneyInput } from "@/shared/format-input";
import { formatRub } from "@/shared/format";
import { useFinanceStore } from "@/modules/finance/finance-store";
import { differenceInMonths, startOfMonth } from "date-fns";

type ScenarioState = {
  amount: string;
  rate: string;
  months: string;
  extra: string;
};

const DEFAULT_A: ScenarioState = {
  amount: "1 000 000",
  rate: "14",
  months: "60",
  extra: "",
};

const DEFAULT_B: ScenarioState = {
  amount: "1 000 000",
  rate: "18",
  months: "36",
  extra: "",
};

function num(raw: string): number {
  const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function monthsUntil(date: Date | string) {
  return Math.max(
    1,
    differenceInMonths(startOfMonth(new Date(date)), startOfMonth(new Date())),
  );
}

function ScenarioFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ScenarioState;
  onChange: (next: ScenarioState) => void;
}) {
  const id = label.toLowerCase();
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{label}</p>
      <FormField label="Сумма, ₽" htmlFor={`loan-amount-${id}`}>
        <Input
          id={`loan-amount-${id}`}
          inputMode="numeric"
          value={value.amount}
          onChange={(e) =>
            onChange({ ...value, amount: formatMoneyInput(e.target.value) })
          }
          placeholder="1 000 000"
        />
      </FormField>
      <FormField label="Ставка, % годовых" htmlFor={`loan-rate-${id}`}>
        <Input
          id={`loan-rate-${id}`}
          inputMode="decimal"
          value={value.rate}
          onChange={(e) => onChange({ ...value, rate: e.target.value })}
          placeholder="14"
        />
      </FormField>
      <FormField label="Срок, мес." htmlFor={`loan-months-${id}`}>
        <Input
          id={`loan-months-${id}`}
          inputMode="numeric"
          value={value.months}
          onChange={(e) => onChange({ ...value, months: e.target.value })}
          placeholder="60"
        />
      </FormField>
      <FormField
        label="Доп. платёж, ₽/мес"
        hint="Необязательно — ускоряет погашение"
        htmlFor={`loan-extra-${id}`}
      >
        <Input
          id={`loan-extra-${id}`}
          inputMode="numeric"
          value={value.extra}
          onChange={(e) =>
            onChange({ ...value, extra: formatMoneyInput(e.target.value) })
          }
          placeholder="0"
        />
      </FormField>
    </div>
  );
}

function ScenarioResult({
  title,
  result,
}: {
  title: string;
  result: ReturnType<typeof amortizeLoan>;
}) {
  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium">{title}</p>
      <p>
        Платёж: <strong>{formatRub(result.monthlyPayment)}</strong>
      </p>
      <p>
        Переплата: <strong>{formatRub(result.totalInterest)}</strong>
      </p>
      <p>
        Всего вернёте: <strong>{formatRub(result.totalPaid)}</strong>
      </p>
      <p>
        Срок: <strong>{result.actualMonths} мес.</strong>
      </p>
    </div>
  );
}

export function LoanCalculator() {
  const { goals } = useFinanceStore();
  const [a, setA] = useState<ScenarioState>(DEFAULT_A);
  const [b, setB] = useState<ScenarioState>(DEFAULT_B);
  const [seedId, setSeedId] = useState("");

  useEffect(() => {
    if (!seedId) return;
    const g = goals.find((x) => x.id === seedId);
    if (!g) return;
    const goalMonths = monthsUntil(g.targetDate);
    const ps = normalizePathSettings(g.pathSettings, goalMonths);
    const next: ScenarioState = {
      amount: formatMoneyInput(String(Math.round(g.targetAmountNominal))),
      rate: String(ps.loanRatePct),
      months: String(ps.loanTermMonths),
      extra: "",
    };
    setA(next);
    setB({
      ...next,
      rate: String(Math.min(50, ps.loanRatePct + 4)),
      months: String(Math.max(1, Math.round(ps.loanTermMonths * 0.6))),
    });
  }, [seedId, goals]);

  const resultA = useMemo(
    () =>
      amortizeLoan({
        principal: num(a.amount),
        annualRatePct: num(a.rate),
        months: Math.max(1, Math.floor(num(a.months)) || 1),
        extraMonthly: num(a.extra),
      }),
    [a],
  );

  const resultB = useMemo(
    () =>
      amortizeLoan({
        principal: num(b.amount),
        annualRatePct: num(b.rate),
        months: Math.max(1, Math.floor(num(b.months)) || 1),
        extraMonthly: num(b.extra),
      }),
    [b],
  );

  const cheaper =
    resultA.totalInterest === resultB.totalInterest
      ? null
      : resultA.totalInterest < resultB.totalInterest
        ? "A"
        : "B";

  return (
    <Card>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Калькулятор
        </p>
        <h3 className="mt-1 font-medium">Сравнение вариантов кредита</h3>
        <HelpHint className="mt-1">{FEATURE_HINTS.loanCalculator}</HelpHint>
      </div>

      {goals.length > 0 && (
        <FormField
          className="mt-3"
          label="Заполнить из цели"
          htmlFor="loan-seed-goal"
          hint="Подставит сумму, срок и ставку из цели (срок = срок цели, если не задан вручную)"
        >
          <select
            id="loan-seed-goal"
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            value={seedId}
            onChange={(e) => setSeedId(e.target.value)}
          >
            <option value="">— Не выбрано —</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} · {formatRub(g.targetAmountNominal)} ·{" "}
                {monthsUntil(g.targetDate)} мес.
              </option>
            ))}
          </select>
        </FormField>
      )}

      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <ScenarioFields label="Вариант A" value={a} onChange={setA} />
        <ScenarioFields label="Вариант B" value={b} onChange={setB} />
      </div>

      <div className="mt-6 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
        <ScenarioResult title="Результат A" result={resultA} />
        <ScenarioResult title="Результат B" result={resultB} />
      </div>

      {cheaper && (
        <p className="mt-4 text-sm text-muted">
          Меньше переплата у варианта <strong>{cheaper}</strong> (экономия{" "}
          {formatRub(Math.abs(resultA.totalInterest - resultB.totalInterest))}
          ).
        </p>
      )}
    </Card>
  );
}
