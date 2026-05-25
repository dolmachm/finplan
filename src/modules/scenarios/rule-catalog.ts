import type { ScenarioRule } from "./rule.types";
import { newRuleId } from "./rule.types";

export interface CatalogField {
  key: string;
  label: string;
  type: "number" | "text" | "select" | "asset" | "month";
  min?: number;
  max?: number;
  options?: Array<{ value: string; label: string }>;
  default?: string | number;
}

export interface CatalogEntry {
  type: string;
  label: string;
  description?: string;
  fields: CatalogField[];
}

export const CONDITION_CATALOG: CatalogEntry[] = [
  {
    type: "always",
    label: "Всегда (без условия)",
    description: "Правило применяется при активном сценарии",
    fields: [],
  },
  {
    type: "market_shock",
    label: "Рыночный шок",
    description: "Кризис на рынке в первый период плана",
    fields: [
      { key: "severityPct", label: "Падение активов, %", type: "number", default: -30, min: -90, max: 0 },
      { key: "durationMonths", label: "Длительность, мес.", type: "number", default: 12, min: 1, max: 60 },
    ],
  },
  {
    type: "no_emergency_fund",
    label: "Нет резерва на N месяцев",
    description: "Ликвидность < расходов × N",
    fields: [
      { key: "months", label: "Месяцев расходов", type: "number", default: 6, min: 1, max: 24 },
    ],
  },
  {
    type: "job_loss",
    label: "Потеря работы",
    description: "Доход = 0 на период",
    fields: [
      { key: "months", label: "Месяцев без дохода", type: "number", default: 6, min: 1, max: 36 },
      { key: "startMonth", label: "С какого месяца", type: "month", default: 0, min: 0, max: 480 },
    ],
  },
  {
    type: "sell_asset_on_date",
    label: "Продажа актива в дату",
    description: "Пользователь выбирает актив и месяц",
    fields: [
      { key: "assetId", label: "Актив", type: "asset" },
      { key: "monthIndex", label: "Месяц продажи", type: "month", default: 24, min: 0, max: 480 },
      { key: "taxPct", label: "Налог, %", type: "number", default: 13, min: 0, max: 50 },
      { key: "feePct", label: "Комиссия, %", type: "number", default: 1, min: 0, max: 10 },
    ],
  },
  {
    type: "expenses_exceed_income",
    label: "Расходы > доходов",
    description: "Средний месячный дефицит",
    fields: [],
  },
  {
    type: "portfolio_overweight",
    label: "Доля класса выше цели",
    description: "Для ребалансировки",
    fields: [
      {
        key: "assetType",
        label: "Класс",
        type: "select",
        options: [
          { value: "BROKERAGE", label: "Брокерский / акции" },
          { value: "DEPOSIT", label: "Вклады" },
          { value: "REAL_ESTATE", label: "Недвижимость" },
        ],
        default: "BROKERAGE",
      },
      { key: "targetPct", label: "Целевая доля, %", type: "number", default: 60, min: 0, max: 100 },
      { key: "deltaPct", label: "Допуск δ, %", type: "number", default: 5, min: 0, max: 30 },
    ],
  },
];

export const ACTION_CATALOG: CatalogEntry[] = [
  {
    type: "noop",
    label: "Ничего не делать",
    description: "Пустое действие",
    fields: [],
  },
  {
    type: "reduce_returns",
    label: "Снизить доходность",
    fields: [
      { key: "pct", label: "На сколько %", type: "number", default: 20, min: 0, max: 100 },
      { key: "months", label: "На сколько мес.", type: "number", default: 12, min: 1, max: 60 },
    ],
  },
  {
    type: "increase_volatility",
    label: "Увеличить волатильность",
    fields: [{ key: "pct", label: "На сколько %", type: "number", default: 10, min: 0, max: 100 }],
  },
  {
    type: "cut_expenses",
    label: "Урезать расходы",
    fields: [
      { key: "pct", label: "Сокращение, %", type: "number", default: 15, min: 0, max: 80 },
      { key: "essentialOnly", label: "Только необязательные", type: "select", options: [{ value: "true", label: "Да" }, { value: "false", label: "Нет" }], default: "true" },
    ],
  },
  {
    type: "income_zero",
    label: "Обнулить доход",
    fields: [{ key: "months", label: "Месяцев", type: "number", default: 6, min: 1, max: 36 }],
  },
  {
    type: "sell_liquid_assets",
    label: "Продать ликвидные активы",
    fields: [
      {
        key: "priority",
        label: "Порядок",
        type: "select",
        options: [
          { value: "liquidity_days_asc", label: "Сначала самые ликвидные" },
          { value: "lowest_return", label: "Сначала с низкой доходностью" },
        ],
        default: "liquidity_days_asc",
      },
      { key: "maxMonthsToSell", label: "Макс. срок продажи, мес.", type: "number", default: 1, min: 1, max: 24 },
    ],
  },
  {
    type: "use_emergency_fund",
    label: "Использовать резерв",
    fields: [],
  },
  {
    type: "sell_asset",
    label: "Продать выбранный актив",
    fields: [
      { key: "assetId", label: "Актив", type: "asset" },
      { key: "monthIndex", label: "Месяц", type: "month", default: 0 },
      { key: "taxPct", label: "Налог, %", type: "number", default: 13 },
      { key: "feePct", label: "Комиссия, %", type: "number", default: 1 },
    ],
  },
  {
    type: "rebalance",
    label: "Ребалансировка",
    fields: [
      { key: "assetType", label: "Класс", type: "select", options: [{ value: "BROKERAGE", label: "Акции" }], default: "BROKERAGE" },
      { key: "targetPct", label: "Целевая доля, %", type: "number", default: 60 },
    ],
  },
];

export const RULE_TEMPLATES: Array<{ key: string; label: string; rule: ScenarioRule }> = [
  {
    key: "crisis_liquidity",
    label: "Кризис: резерв или продажа",
    rule: {
      id: newRuleId(),
      name: "Кризис — ликвидность",
      enabled: true,
      condition: { type: "no_emergency_fund", params: { months: 6 } },
      then: { type: "sell_liquid_assets", params: { priority: "liquidity_days_asc", maxMonthsToSell: 1 } },
      else: { type: "use_emergency_fund", params: {} },
    },
  },
  {
    key: "job_loss_cut",
    label: "Потеря работы",
    rule: {
      id: newRuleId(),
      name: "Потеря работы",
      enabled: true,
      condition: { type: "job_loss", params: { months: 6, startMonth: 0 } },
      then: { type: "cut_expenses", params: { pct: 20, essentialOnly: "true" } },
      else: { type: "noop", params: {} },
    },
  },
  {
    key: "sell_asset_rule",
    label: "Продажа актива",
    rule: {
      id: newRuleId(),
      name: "Продажа актива",
      enabled: true,
      condition: { type: "sell_asset_on_date", params: { monthIndex: 24, taxPct: 13, feePct: 1 } },
      then: { type: "sell_asset", params: { monthIndex: 24, taxPct: 13, feePct: 1 } },
    },
  },
  {
    key: "market_shock_returns",
    label: "Рыночный шок → доходность",
    rule: {
      id: newRuleId(),
      name: "Шок рынка",
      enabled: true,
      condition: { type: "market_shock", params: { severityPct: -30, durationMonths: 12 } },
      then: { type: "reduce_returns", params: { pct: 25, months: 12 } },
      else: { type: "noop", params: {} },
    },
  },
  {
    key: "nested_crisis",
    label: "Вложенный IF: шок → ликвидность",
    rule: {
      id: newRuleId(),
      name: "Кризис с вложением",
      enabled: true,
      condition: { type: "market_shock", params: { severityPct: -30, durationMonths: 12 } },
      then: {
        type: "nested",
        rules: [
          {
            id: newRuleId(),
            name: "Внутри: нет резерва?",
            enabled: true,
            condition: { type: "no_emergency_fund", params: { months: 6 } },
            then: { type: "sell_liquid_assets", params: { priority: "liquidity_days_asc" } },
            else: { type: "use_emergency_fund", params: {} },
          },
        ],
      },
      else: { type: "reduce_returns", params: { pct: 10, months: 6 } },
    },
  },
];

export function getConditionEntry(type: string) {
  return CONDITION_CATALOG.find((c) => c.type === type);
}

export function getActionEntry(type: string) {
  return ACTION_CATALOG.find((a) => a.type === type);
}
