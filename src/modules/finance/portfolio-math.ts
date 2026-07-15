import type { PortfolioHolding, PortfolioSleeve } from "@/shared/types";

export type SleeveMetrics = {
  sleeve: PortfolioSleeve;
  value: number;
  weightPct: number;
  expectedReturnPct: number;
  dividendYieldPct: number;
  volatilityPct: number;
  /** Contribution to portfolio expected return: weight * return */
  contributionReturnPct: number;
  targetWeightPct: number | null;
  targetDriftPct: number | null;
};

export type PortfolioMetrics = {
  totalValue: number;
  expectedReturnPct: number;
  volatilityPct: number;
  dividendYieldPct: number;
  /** Monthly income from yields, ₽ */
  dividendIncomeMonthly: number;
  bySleeve: SleeveMetrics[];
};

function weightedAvg(
  items: Array<{ value: number; metric: number }>,
  total: number,
): number {
  if (total <= 0) return 0;
  return items.reduce((s, i) => s + i.value * i.metric, 0) / total;
}

/** Aggregate holdings into portfolio-level and per-sleeve metrics (CFP). */
export function computePortfolioMetrics(
  holdings: PortfolioHolding[],
): PortfolioMetrics {
  const totalValue = holdings.reduce((s, h) => s + Math.max(0, h.currentValue), 0);

  const expectedReturnPct = weightedAvg(
    holdings.map((h) => ({ value: h.currentValue, metric: h.expectedReturnPct })),
    totalValue,
  );
  const volatilityPct = weightedAvg(
    holdings.map((h) => ({ value: h.currentValue, metric: h.volatilityPct })),
    totalValue,
  );
  const dividendYieldPct = weightedAvg(
    holdings.map((h) => ({ value: h.currentValue, metric: h.dividendYieldPct })),
    totalValue,
  );
  const dividendIncomeMonthly =
    totalValue > 0 ? (totalValue * dividendYieldPct) / 100 / 12 : 0;

  const sleeveMap = new Map<
    PortfolioSleeve,
    {
      value: number;
      returnSum: number;
      yieldSum: number;
      volSum: number;
      targetSum: number;
      targetCount: number;
    }
  >();

  for (const h of holdings) {
    const v = Math.max(0, h.currentValue);
    const cur = sleeveMap.get(h.sleeve) ?? {
      value: 0,
      returnSum: 0,
      yieldSum: 0,
      volSum: 0,
      targetSum: 0,
      targetCount: 0,
    };
    cur.value += v;
    cur.returnSum += v * h.expectedReturnPct;
    cur.yieldSum += v * h.dividendYieldPct;
    cur.volSum += v * h.volatilityPct;
    if (h.targetWeightPct != null) {
      cur.targetSum += h.targetWeightPct;
      cur.targetCount += 1;
    }
    sleeveMap.set(h.sleeve, cur);
  }

  const bySleeve: SleeveMetrics[] = [...sleeveMap.entries()]
    .map(([sleeve, cur]) => {
      const weightPct = totalValue > 0 ? (cur.value / totalValue) * 100 : 0;
      const expected = cur.value > 0 ? cur.returnSum / cur.value : 0;
      const yieldPct = cur.value > 0 ? cur.yieldSum / cur.value : 0;
      const vol = cur.value > 0 ? cur.volSum / cur.value : 0;
      const targetWeightPct =
        cur.targetCount > 0 ? cur.targetSum : null;
      return {
        sleeve,
        value: cur.value,
        weightPct,
        expectedReturnPct: expected,
        dividendYieldPct: yieldPct,
        volatilityPct: vol,
        contributionReturnPct: (weightPct / 100) * expected,
        targetWeightPct,
        targetDriftPct:
          targetWeightPct != null ? weightPct - targetWeightPct : null,
      };
    })
    .sort((a, b) => b.value - a.value);

  return {
    totalValue,
    expectedReturnPct,
    volatilityPct,
    dividendYieldPct,
    dividendIncomeMonthly,
    bySleeve,
  };
}

/**
 * When holdings are present, roll-up value/return/vol/dividends onto parent Asset fields.
 * Empty holdings → no change (caller keeps manual fields).
 */
export function syncAssetFromHoldings<
  T extends {
    currentValue: number;
    expectedReturnPct: number;
    volatilityPct: number;
    dividendIncomeMonthly: number;
    portfolioHoldings?: PortfolioHolding[];
  },
>(asset: T): T {
  const holdings = asset.portfolioHoldings;
  if (!holdings || holdings.length === 0) return asset;
  const m = computePortfolioMetrics(holdings);
  return {
    ...asset,
    currentValue: m.totalValue,
    expectedReturnPct: round2(m.expectedReturnPct),
    volatilityPct: round2(m.volatilityPct),
    dividendIncomeMonthly: round2(m.dividendIncomeMonthly),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type RebalanceTargets = Partial<Record<PortfolioSleeve, number>>;

export type RebalanceRow = {
  sleeve: PortfolioSleeve;
  currentValue: number;
  currentPct: number;
  targetPct: number;
  /** Positive = buy, negative = sell */
  deltaValue: number;
};

export type RebalanceResult = {
  totalValue: number;
  targetSumPct: number;
  rows: RebalanceRow[];
};

/** Buy/sell amounts to reach target sleeve weights (sum of portfolio unchanged). */
export function computeRebalance(
  holdings: PortfolioHolding[],
  targets: RebalanceTargets,
): RebalanceResult {
  const totalValue = holdings.reduce((s, h) => s + Math.max(0, h.currentValue), 0);
  const bySleeve = new Map<PortfolioSleeve, number>();
  for (const h of holdings) {
    const sleeve = h.sleeve;
    bySleeve.set(sleeve, (bySleeve.get(sleeve) ?? 0) + Math.max(0, h.currentValue));
  }

  const sleeves = new Set<PortfolioSleeve>([
    ...bySleeve.keys(),
    ...(Object.keys(targets) as PortfolioSleeve[]).filter(
      (s) => (targets[s] ?? 0) > 0 || bySleeve.has(s),
    ),
  ]);

  const rows: RebalanceRow[] = [...sleeves]
    .filter((sleeve) => bySleeve.has(sleeve))
    .map((sleeve) => {
      const currentValue = bySleeve.get(sleeve) ?? 0;
      const currentPct = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
      const targetPct = Math.max(0, targets[sleeve] ?? 0);
      const deltaValue = totalValue * (targetPct / 100) - currentValue;
      return {
        sleeve,
        currentValue,
        currentPct,
        targetPct,
        deltaValue: round2(deltaValue),
      };
    })
    .sort((a, b) => b.currentValue - a.currentValue);

  const targetSumPct = rows.reduce((s, r) => s + r.targetPct, 0);

  return { totalValue, targetSumPct, rows };
}

/**
 * Redistribute holding values within existing sleeves to match targets.
 * Portfolio total value stays the same; does not create new sleeves.
 */
export function applyRebalanceToHoldings(
  holdings: PortfolioHolding[],
  targets: RebalanceTargets,
): PortfolioHolding[] {
  const { totalValue, rows } = computeRebalance(holdings, targets);
  if (totalValue <= 0 || rows.length === 0) return holdings;

  const targetValueBySleeve = new Map(
    rows.map((r) => [r.sleeve, (totalValue * r.targetPct) / 100] as const),
  );
  const currentBySleeve = new Map(
    rows.map((r) => [r.sleeve, r.currentValue] as const),
  );

  return applyTargetsToHoldings(
    holdings.map((h) => {
      const currentSleeve = currentBySleeve.get(h.sleeve) ?? 0;
      const targetSleeve = targetValueBySleeve.get(h.sleeve) ?? 0;
      if (currentSleeve <= 0) return h;
      const scale = targetSleeve / currentSleeve;
      return {
        ...h,
        currentValue: round2(Math.max(0, h.currentValue) * scale),
      };
    }),
    targets,
  );
}

/** Seed calculator targets from stored targetWeightPct or current weights. */
export function seedRebalanceTargets(
  holdings: PortfolioHolding[],
): RebalanceTargets {
  const metrics = computePortfolioMetrics(holdings);
  const targets: RebalanceTargets = {};
  for (const s of metrics.bySleeve) {
    targets[s.sleeve] =
      s.targetWeightPct != null
        ? round2(s.targetWeightPct)
        : round2(s.weightPct);
  }
  return targets;
}

/** Write sleeve targets onto holdings (one value per sleeve on largest position). */
export function applyTargetsToHoldings(
  holdings: PortfolioHolding[],
  targets: RebalanceTargets,
): PortfolioHolding[] {
  const largestIdBySleeve = new Map<PortfolioSleeve, string>();
  const valueById = new Map(holdings.map((h) => [h.id, h.currentValue]));
  for (const h of holdings) {
    const prev = largestIdBySleeve.get(h.sleeve);
    if (
      !prev ||
      (valueById.get(h.id) ?? 0) > (valueById.get(prev) ?? 0)
    ) {
      largestIdBySleeve.set(h.sleeve, h.id);
    }
  }
  return holdings.map((h) => {
    const isPrimary = largestIdBySleeve.get(h.sleeve) === h.id;
    const t = targets[h.sleeve];
    return {
      ...h,
      targetWeightPct: isPrimary && t != null ? t : isPrimary ? h.targetWeightPct : null,
    };
  });
}

export function newHoldingId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
