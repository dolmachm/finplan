import type { ScenarioModifiers } from "@/modules/plan/types";
import type { ScenarioRule } from "./rule.types";

export type { ScenarioRule } from "./rule.types";

export interface ScenarioTemplate {
  key: string;
  name: string;
  description: string;
  /** Короткий совет CFP: зачем смотреть этот сценарий */
  cfpTip?: string;
  /** Показывать в подсказках после заполнения базового плана */
  suggestAfterBase?: boolean;
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
    cfpTip: "Проверьте запас прочности, если рынок и цены разойдутся не в вашу пользу.",
    suggestAfterBase: true,
    modifiers: { returnMultiplier: 0.85, inflationMultiplier: 1.25 },
    rules: [],
  },
  {
    key: "crisis",
    name: "Кризис",
    description: "−30% активов, потеря дохода 6 мес., рост волатильности",
    cfpTip: "Классический стресс-тест CFP: рынок + потеря дохода + резерв.",
    suggestAfterBase: true,
    modifiers: {
      assetShockPct: -30,
      incomeLossMonths: 6,
      returnMultiplier: 0.7,
      expenseCutPct: 15,
    },
    rules: [
      {
        id: "tpl-crisis-liquidity",
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
    key: "job_loss",
    name: "Потеря работы",
    description: "6 месяцев без дохода, урезание необязательных расходов",
    cfpTip: "Сколько месяцев продержитесь без зарплаты при текущих расходах и резерве.",
    suggestAfterBase: true,
    modifiers: { incomeLossMonths: 6, expenseCutPct: 20 },
    rules: [
      {
        id: "tpl-job-loss",
        name: "Потеря работы",
        enabled: true,
        condition: { type: "job_loss", params: { months: 6, startMonth: 0 } },
        then: { type: "cut_expenses", params: { pct: 20, essentialOnly: "true" } },
        else: { type: "noop", params: {} },
      },
    ],
  },
  {
    key: "inflation_shock",
    name: "Инфляция +2 п.п.",
    description: "Цены растут быстрее базового прогноза",
    cfpTip: "Цели в номинале дорожают — проверьте, успеваете ли копить.",
    suggestAfterBase: true,
    modifiers: { inflationDeltaPct: 2 },
    rules: [
      {
        id: "tpl-inflation",
        name: "Инфляция +2 пункта",
        enabled: true,
        condition: { type: "always", params: {} },
        then: { type: "change_inflation", params: { mode: "delta", deltaPct: 2 } },
      },
    ],
  },
  {
    key: "dividend_cut",
    name: "Падение пассивного дохода",
    description: "Дивиденды и аренда −50%",
    cfpTip: "Если часть бюджета зависит от активов — как план держится без них.",
    suggestAfterBase: true,
    modifiers: { dividendMultiplier: 0.5 },
    rules: [
      {
        id: "tpl-div-cut",
        name: "Дивиденды −50%",
        enabled: true,
        condition: { type: "always", params: {} },
        then: { type: "change_dividends", params: { pct: -50 } },
      },
    ],
  },
  {
    key: "aggressive",
    name: "Агрессивный рост",
    description: "Повышенная ожидаемая доходность (+15%)",
    cfpTip: "Оптимистичный ориентир: что будет при удачной доходности портфеля.",
    suggestAfterBase: true,
    modifiers: { returnMultiplier: 1.15 },
    rules: [],
  },
  {
    key: "hyperinflation",
    name: "Гиперинфляция",
    description: "Инфляция ×2 к базовой",
    cfpTip: "Жёсткий сценарий для длинного горизонта и крупных целей.",
    suggestAfterBase: true,
    modifiers: { inflationMultiplier: 2 },
    rules: [],
  },
  {
    key: "expense_spike",
    name: "Рост расходов",
    description: "Жизненные траты выше: меньше профицита на цели",
    cfpTip: "Семья, жильё, здоровье — типичный сдвиг бюджета без смены дохода.",
    suggestAfterBase: true,
    modifiers: { expenseCutPct: -15 },
    rules: [],
  },
];

/** Шаблоны, которых ещё нет у пользователя (по templateKey) */
export function getCfpScenarioSuggestions(
  existingTemplateKeys: Array<string | null | undefined>,
): ScenarioTemplate[] {
  const have = new Set(
    existingTemplateKeys.filter((k): k is string => !!k && k !== "base"),
  );
  return PREDEFINED_SCENARIOS.filter(
    (t) => t.suggestAfterBase && t.key !== "base" && !have.has(t.key),
  );
}
