"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { FormField, HelpHint } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { FEATURE_HINTS } from "@/content/help";
import {
  compareRepaymentStrategies,
  type PayoffStrategyKind,
} from "@/modules/finance/loan-math";
import { formatMoneyInput } from "@/shared/format-input";
import { formatRub } from "@/shared/format";
import type { Liability } from "@/shared/types";

const KIND_HINT: Record<PayoffStrategyKind, string> = {
  minimum: "Только минимальные платежи без досрочки",
  avalanche: "Сначала закрываем долг с самой высокой ставкой",
  snowball: "Сначала закрываем долг с наименьшим остатком",
};

export function DebtPayoffStrategies({
  liabilities,
}: {
  liabilities: Liability[];
}) {
  const [extra, setExtra] = useState("");

  const comparison = useMemo(() => {
    const debts = liabilities.map((l) => ({
      id: l.id,
      name: l.name,
      remainingBalance: l.remainingBalance,
      interestRatePct: l.interestRatePct,
      monthlyPayment: l.monthlyPayment,
    }));
    const extraN = Number(String(extra).replace(/\s/g, "").replace(",", "."));
    return compareRepaymentStrategies(
      debts,
      Number.isFinite(extraN) ? Math.max(0, extraN) : 0,
    );
  }, [liabilities, extra]);

  const recommended = comparison.strategies.find(
    (s) => s.kind === comparison.recommendedKind,
  );

  if (liabilities.length === 0) {
    return (
      <Card>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Стратегии
          </p>
          <h3 className="mt-1 font-medium">Погашение обязательств</h3>
          <HelpHint className="mt-1">
            Добавьте пассивы выше — здесь появится сравнение стратегий досрочного
            погашения.
          </HelpHint>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Стратегии
        </p>
        <h3 className="mt-1 font-medium">Погашение обязательств</h3>
        <HelpHint className="mt-1">{FEATURE_HINTS.debtPayoff}</HelpHint>
      </div>

      <div className="mt-4 max-w-xs">
        <FormField
          label="Доп. платёж, ₽/мес"
          hint="Сверх всех минимальных платежей"
          htmlFor="payoff-extra"
        >
          <Input
            id="payoff-extra"
            inputMode="numeric"
            value={extra}
            onChange={(e) => setExtra(formatMoneyInput(e.target.value))}
            placeholder="10 000"
          />
        </FormField>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {comparison.strategies.map((s) => {
          const isRec = s.kind === comparison.recommendedKind && s.kind !== "minimum";
          return (
            <div
              key={s.kind}
              className={`rounded-lg border p-3 text-sm ${
                isRec ? "border-brand bg-accent-light/40" : "border-border"
              }`}
            >
              <p className="font-medium">
                {s.label}
                {isRec ? " · выгодно" : ""}
              </p>
              <p className="mt-1 text-xs text-muted">{KIND_HINT[s.kind]}</p>
              <p className="mt-3">
                Срок: <strong>{s.months} мес.</strong>
              </p>
              <p>
                Проценты: <strong>{formatRub(s.totalInterest)}</strong>
              </p>
              {s.kind !== "minimum" && (
                <p>
                  Экономия: <strong>{formatRub(s.interestSaved)}</strong>
                </p>
              )}
            </div>
          );
        })}
      </div>

      {recommended && recommended.payoffOrder.length > 0 && (
        <div className="mt-4 text-sm">
          <p className="font-medium">
            Порядок при стратегии «{recommended.label}»:
          </p>
          <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-muted">
            {recommended.payoffOrder.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}
