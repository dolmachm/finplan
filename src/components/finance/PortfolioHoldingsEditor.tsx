"use client";

import { Button } from "@/components/ui/button";
import { FormField, HelpHint } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { FEATURE_HINTS, FIELD_HINTS } from "@/content/help";
import {
  computePortfolioMetrics,
  newHoldingId,
} from "@/modules/finance/portfolio-math";
import {
  PORTFOLIO_SLEEVE_OPTIONS,
  portfolioSleeveLabel,
} from "@/shared/finance-catalog";
import { formatMoneyInput } from "@/shared/format-input";
import { formatRub } from "@/shared/format";
import type { PortfolioHolding, PortfolioSleeve } from "@/shared/types";
import { RebalanceCalculator } from "@/components/finance/RebalanceCalculator";
import { selectClass } from "@/components/ui/form-controls";

type DraftHolding = {
  id: string;
  name: string;
  sleeve: PortfolioSleeve;
  currentValue: string;
  expectedReturnPct: string;
  dividendYieldPct: string;
  growthRatePct: string;
  volatilityPct: string;
  targetWeightPct: string;
};

function toDraft(h: PortfolioHolding): DraftHolding {
  return {
    id: h.id,
    name: h.name,
    sleeve: h.sleeve,
    currentValue: formatMoneyInput(String(h.currentValue)),
    expectedReturnPct: String(h.expectedReturnPct),
    dividendYieldPct: String(h.dividendYieldPct),
    growthRatePct: String(h.growthRatePct),
    volatilityPct: String(h.volatilityPct),
    targetWeightPct:
      h.targetWeightPct != null ? String(h.targetWeightPct) : "",
  };
}

function parseMoney(raw: string): number {
  const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function parsePct(raw: string): number {
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function draftsToHoldings(drafts: DraftHolding[]): PortfolioHolding[] {
  return drafts
    .filter((d) => d.name.trim())
    .map((d) => ({
      id: d.id,
      name: d.name.trim(),
      sleeve: d.sleeve,
      currentValue: parseMoney(d.currentValue),
      expectedReturnPct: parsePct(d.expectedReturnPct),
      dividendYieldPct: parsePct(d.dividendYieldPct),
      growthRatePct: parsePct(d.growthRatePct),
      volatilityPct: parsePct(d.volatilityPct),
      targetWeightPct: d.targetWeightPct.trim()
        ? parsePct(d.targetWeightPct)
        : null,
      notes: null,
    }));
}

export function holdingsToDrafts(
  holdings: PortfolioHolding[] | undefined,
): DraftHolding[] {
  return (holdings ?? []).map(toDraft);
}

export function emptyDraft(): DraftHolding {
  return {
    id: newHoldingId(),
    name: "",
    sleeve: "EQUITY",
    currentValue: "",
    expectedReturnPct: "8",
    dividendYieldPct: "0",
    growthRatePct: "0",
    volatilityPct: "15",
    targetWeightPct: "",
  };
}

export function PortfolioHoldingsEditor({
  drafts,
  onChange,
}: {
  drafts: DraftHolding[];
  onChange: (next: DraftHolding[]) => void;
}) {
  const holdings = draftsToHoldings(drafts);
  const metrics = computePortfolioMetrics(holdings);

  function update(id: string, patch: Partial<DraftHolding>) {
    onChange(drafts.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function remove(id: string) {
    onChange(drafts.filter((d) => d.id !== id));
  }

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-border/80 p-3">
      <div>
        <p className="text-sm font-medium">Портфель по классам активов</p>
        <HelpHint className="mt-1">{FEATURE_HINTS.portfolioHoldings}</HelpHint>
      </div>

      {drafts.length === 0 ? (
        <p className="text-sm text-muted">
          Нет позиций — добавьте класс активов или оставьте счёт без детализации.
        </p>
      ) : (
        <ul className="space-y-4">
          {drafts.map((d, idx) => (
            <li
              key={d.id}
              className="grid gap-3 border-t border-border/60 pt-3 first:border-t-0 first:pt-0 sm:grid-cols-2"
            >
              <div className="sm:col-span-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted">
                  Позиция {idx + 1}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 px-2 text-xs"
                  onClick={() => remove(d.id)}
                >
                  Удалить
                </Button>
              </div>
              <FormField label="Название" htmlFor={`ph-name-${d.id}`}>
                <Input
                  id={`ph-name-${d.id}`}
                  value={d.name}
                  onChange={(e) => update(d.id, { name: e.target.value })}
                  placeholder="Акции РФ / ETF"
                />
              </FormField>
              <FormField label="Класс активов" htmlFor={`ph-sleeve-${d.id}`}>
                <select
                  id={`ph-sleeve-${d.id}`}
                  className={selectClass}
                  value={d.sleeve}
                  onChange={(e) =>
                    update(d.id, { sleeve: e.target.value as PortfolioSleeve })
                  }
                >
                  {PORTFOLIO_SLEEVE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Стоимость, ₽" htmlFor={`ph-val-${d.id}`}>
                <Input
                  id={`ph-val-${d.id}`}
                  inputMode="numeric"
                  value={d.currentValue}
                  onChange={(e) =>
                    update(d.id, {
                      currentValue: formatMoneyInput(e.target.value),
                    })
                  }
                  placeholder="500 000"
                />
              </FormField>
              <FormField
                label="Рост капитала, % год"
                htmlFor={`ph-ret-${d.id}`}
                hint={FIELD_HINTS.holdingReturn}
              >
                <Input
                  id={`ph-ret-${d.id}`}
                  inputMode="decimal"
                  value={d.expectedReturnPct}
                  onChange={(e) =>
                    update(d.id, { expectedReturnPct: e.target.value })
                  }
                  placeholder="8"
                />
              </FormField>
              <FormField
                label="Выплаты, % в год"
                htmlFor={`ph-yield-${d.id}`}
                hint={FIELD_HINTS.holdingYield}
              >
                <Input
                  id={`ph-yield-${d.id}`}
                  inputMode="decimal"
                  value={d.dividendYieldPct}
                  onChange={(e) =>
                    update(d.id, { dividendYieldPct: e.target.value })
                  }
                  placeholder="4"
                />
              </FormField>
              <FormField
                label="Рост выплат, % год"
                htmlFor={`ph-growth-${d.id}`}
              >
                <Input
                  id={`ph-growth-${d.id}`}
                  inputMode="decimal"
                  value={d.growthRatePct}
                  onChange={(e) =>
                    update(d.id, { growthRatePct: e.target.value })
                  }
                  placeholder="2"
                />
              </FormField>
              <FormField label="Волатильность, %" htmlFor={`ph-vol-${d.id}`}>
                <Input
                  id={`ph-vol-${d.id}`}
                  inputMode="decimal"
                  value={d.volatilityPct}
                  onChange={(e) =>
                    update(d.id, { volatilityPct: e.target.value })
                  }
                  placeholder="15"
                />
              </FormField>
              <FormField
                label="Целевая доля, %"
                htmlFor={`ph-target-${d.id}`}
                hint={FIELD_HINTS.holdingTarget}
              >
                <Input
                  id={`ph-target-${d.id}`}
                  inputMode="decimal"
                  value={d.targetWeightPct}
                  onChange={(e) =>
                    update(d.id, { targetWeightPct: e.target.value })
                  }
                  placeholder="40"
                />
              </FormField>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="secondary"
        onClick={() => onChange([...drafts, emptyDraft()])}
      >
        + Класс активов
      </Button>

      {holdings.length > 0 && (
        <div className="space-y-2 rounded-md bg-muted/40 p-3 text-sm">
          <p className="font-medium">Сводка портфеля</p>
          <p>
            Стоимость: {formatRub(metrics.totalValue)} · доходность{" "}
            {metrics.expectedReturnPct.toFixed(1)}% · выплаты{" "}
            {metrics.dividendYieldPct.toFixed(1)}% · доход/мес{" "}
            {formatRub(metrics.dividendIncomeMonthly)}
          </p>
          {metrics.bySleeve.length > 0 && (
            <ul className="space-y-1 text-muted">
              {metrics.bySleeve.map((s) => (
                <li key={s.sleeve}>
                  {portfolioSleeveLabel(s.sleeve)}: {s.weightPct.toFixed(0)}% ·{" "}
                  {s.expectedReturnPct.toFixed(1)}% · вклад{" "}
                  {s.contributionReturnPct.toFixed(1)} п.п.
                  {s.targetDriftPct != null &&
                    Math.abs(s.targetDriftPct) >= 0.5 && (
                      <span>
                        {" "}
                        · отклонение {s.targetDriftPct > 0 ? "+" : ""}
                        {s.targetDriftPct.toFixed(0)} п.п.
                      </span>
                    )}
                </li>
              ))}
            </ul>
          )}
          <RebalanceCalculator
            holdings={holdings}
            onHoldingsChange={(next) => onChange(holdingsToDrafts(next))}
          />
        </div>
      )}
    </div>
  );
}
