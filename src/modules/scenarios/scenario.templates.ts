import type { ScenarioModifiers } from "@/modules/plan/types";
import type { ScenarioRule } from "./rule.types";

export type { ScenarioRule } from "./rule.types";

export interface ScenarioTemplate {
  key: string;
  name: string;
  description: string;
  modifiers: ScenarioModifiers;
  rules: ScenarioRule[];
}

export const PREDEFINED_SCENARIOS: ScenarioTemplate[] = [
  {
    key: "base",
    name: "Базовый",
    description: "Текущие предположения без шоков",
    modifiers: {},
    rules: [],
  },
  {
    key: "conservative",
    name: "Консервативный",
    description: "Снижение доходности на 2%, инфляция +1%",
    modifiers: { returnMultiplier: 0.85, inflationMultiplier: 1.25 },
    rules: [],
  },
  {
    key: "crisis",
    name: "Кризис",
    description: "−30% активов, потеря дохода 6 мес., рост волатильности",
    modifiers: {
      assetShockPct: -30,
      incomeLossMonths: 6,
      returnMultiplier: 0.7,
      expenseCutPct: 15,
    },
    rules: [
      {
        id: "crisis-liquidity",
        name: "Кризис — ликвидность",
        enabled: true,
        condition: { type: "no_emergency_fund", params: { months: 6 } },
        then: {
          type: "sell_liquid_assets",
          params: { priority: "liquidity_days_asc" },
        },
        else: { type: "use_emergency_fund", params: {} },
      },
    ],
  },
  {
    key: "aggressive",
    name: "Агрессивный",
    description: "Повышенная ожидаемая доходность (+15%)",
    modifiers: { returnMultiplier: 1.15 },
    rules: [],
  },
  {
    key: "hyperinflation",
    name: "Гиперинфляция",
    description: "Инфляция ×2 к базовой",
    modifiers: { inflationMultiplier: 2 },
    rules: [],
  },
];

/** @deprecated use resolveScenarioModifiers with planInput */
export function modifiersFromScenarioParams(
  params: Record<string, unknown>,
): ScenarioModifiers {
  const key = params.templateKey as string | undefined;
  const template = PREDEFINED_SCENARIOS.find((t) => t.key === key);
  return {
    ...template?.modifiers,
    ...(params.modifiers as ScenarioModifiers | undefined),
  };
}
