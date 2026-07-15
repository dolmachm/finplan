"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField, HelpHint } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { FEATURE_HINTS } from "@/content/help";
import {
  applyRebalanceToHoldings,
  applyTargetsToHoldings,
  computeRebalance,
  seedRebalanceTargets,
  type RebalanceTargets,
} from "@/modules/finance/portfolio-math";
import { portfolioSleeveLabel } from "@/shared/finance-catalog";
import { formatRub } from "@/shared/format";
import type { PortfolioHolding, PortfolioSleeve } from "@/shared/types";

function parsePct(raw: string): number {
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function RebalanceCalculator({
  holdings,
  onHoldingsChange,
}: {
  holdings: PortfolioHolding[];
  onHoldingsChange: (next: PortfolioHolding[]) => void;
}) {
  const [targetInputs, setTargetInputs] = useState<Record<string, string>>(
    () => {
      const seeded = seedRebalanceTargets(holdings);
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(seeded)) {
        out[k] = String(v ?? 0);
      }
      return out;
    },
  );

  const sleeveKey = holdings
    .map((h) => h.sleeve)
    .sort()
    .join("|");

  useEffect(() => {
    const seeded = seedRebalanceTargets(holdings);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(seeded)) {
      out[k] = String(v ?? 0);
    }
    setTargetInputs(out);
  }, [sleeveKey]);

  const targets: RebalanceTargets = {};
  for (const [sleeve, raw] of Object.entries(targetInputs)) {
    targets[sleeve as PortfolioSleeve] = parsePct(raw);
  }

  const result = computeRebalance(holdings, targets);
  const sumOk = Math.abs(result.targetSumPct - 100) <= 0.5;

  function writeTargets() {
    onHoldingsChange(applyTargetsToHoldings(holdings, targets));
  }

  function applyRebalance() {
    if (!sumOk) return;
    onHoldingsChange(applyRebalanceToHoldings(holdings, targets));
  }

  if (holdings.length === 0 || result.rows.length === 0) return null;

  return (
    <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
      <div>
        <p className="text-sm font-medium">Ребалансировка</p>
        <HelpHint className="mt-1">{FEATURE_HINTS.rebalance}</HelpHint>
      </div>

      <ul className="space-y-3">
        {result.rows.map((row) => (
          <li
            key={row.sleeve}
            className="grid gap-2 sm:grid-cols-[1fr_5rem_auto] sm:items-end"
          >
            <div className="text-sm">
              <p className="font-medium">{portfolioSleeveLabel(row.sleeve)}</p>
              <p className="text-xs text-muted">
                Сейчас {row.currentPct.toFixed(1)}% ({formatRub(row.currentValue)})
              </p>
            </div>
            <FormField label="Цель %" htmlFor={`reb-t-${row.sleeve}`}>
              <Input
                id={`reb-t-${row.sleeve}`}
                inputMode="decimal"
                value={targetInputs[row.sleeve] ?? ""}
                onChange={(e) =>
                  setTargetInputs((prev) => ({
                    ...prev,
                    [row.sleeve]: e.target.value,
                  }))
                }
                placeholder="40"
              />
            </FormField>
            <p className="text-sm tabular-nums sm:pb-2.5">
              {Math.abs(row.deltaValue) < 0.5 ? (
                <span className="text-muted">—</span>
              ) : row.deltaValue > 0 ? (
                <span>Купить {formatRub(row.deltaValue)}</span>
              ) : (
                <span>Продать {formatRub(-row.deltaValue)}</span>
              )}
            </p>
          </li>
        ))}
      </ul>

      <p
        className={`text-xs ${sumOk ? "text-muted" : "text-amber-700 dark:text-amber-400"}`}
      >
        Сумма целей: {result.targetSumPct.toFixed(1)}%
        {!sumOk && " — должна быть ≈ 100%"}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={writeTargets}>
          Записать цели
        </Button>
        <Button type="button" onClick={applyRebalance} disabled={!sumOk}>
          Применить ребаланс
        </Button>
      </div>
    </div>
  );
}
