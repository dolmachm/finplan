export const REGULATORY_DISCLAIMER =
  "Результаты носят информационный характер и не являются индивидуальной инвестиционной рекомендацией. Все расчёты основаны на ваших предположениях о доходности, инфляции и налогах.";

export const REPORT_BLOCK_IDS = [
  "cover",
  "executive",
  "balance",
  "cashflow",
  "goals",
  "assumptions",
  "projection",
  "insights",
  "recommendations",
] as const;

export type ReportBlockId = (typeof REPORT_BLOCK_IDS)[number];

export type ReportItemId =
  | "cover_title"
  | "cover_client"
  | "cover_date"
  | "cover_disclaimer"
  | "exec_netWorth"
  | "exec_surplus"
  | "exec_cushion"
  | "exec_kdr"
  | "exec_saving"
  | "exec_narrative"
  | "bal_assets"
  | "bal_liabilities"
  | "bal_netWorth"
  | "cf_income"
  | "cf_expenses"
  | "cf_surplus"
  | "goals_list"
  | "goals_funding"
  | "goals_probability"
  | "asm_inflation"
  | "asm_horizon"
  | "asm_tax"
  | "proj_finalNw"
  | "proj_chart"
  | "proj_avgSurplus"
  | "insights_list"
  | "recs_list";

export type ReportTextKey =
  | "title"
  | "disclaimer"
  | "executiveNarrative"
  | "insightsIntro"
  | "recommendationsIntro";

export type ReportBlockDef = {
  id: ReportBlockId;
  label: string;
  items: Array<{ id: ReportItemId; label: string }>;
};

export type ReportConfig = {
  blocks: Record<ReportBlockId, boolean>;
  items: Record<ReportItemId, boolean>;
  texts: Record<ReportTextKey, string>;
};

export const REPORT_BLOCK_DEFS: ReportBlockDef[] = [
  {
    id: "cover",
    label: "Обложка",
    items: [
      { id: "cover_title", label: "Заголовок" },
      { id: "cover_client", label: "Клиент" },
      { id: "cover_date", label: "Дата" },
      { id: "cover_disclaimer", label: "Дисклеймер" },
    ],
  },
  {
    id: "executive",
    label: "Исполнительное резюме",
    items: [
      { id: "exec_netWorth", label: "Чистые активы" },
      { id: "exec_surplus", label: "Профицит" },
      { id: "exec_cushion", label: "Подушка" },
      { id: "exec_kdr", label: "КДР" },
      { id: "exec_saving", label: "Рекомендуемый взнос" },
      { id: "exec_narrative", label: "Текст резюме" },
    ],
  },
  {
    id: "balance",
    label: "Точка 0 (баланс)",
    items: [
      { id: "bal_assets", label: "Активы" },
      { id: "bal_liabilities", label: "Обязательства" },
      { id: "bal_netWorth", label: "Чистые активы" },
    ],
  },
  {
    id: "cashflow",
    label: "Денежный поток",
    items: [
      { id: "cf_income", label: "Доходы" },
      { id: "cf_expenses", label: "Расходы" },
      { id: "cf_surplus", label: "Профицит" },
    ],
  },
  {
    id: "goals",
    label: "Цели",
    items: [
      { id: "goals_list", label: "Список целей" },
      { id: "goals_funding", label: "Финансируемость" },
      { id: "goals_probability", label: "Вероятности MC" },
    ],
  },
  {
    id: "assumptions",
    label: "Предположения",
    items: [
      { id: "asm_inflation", label: "Инфляция" },
      { id: "asm_horizon", label: "Горизонт" },
      { id: "asm_tax", label: "Налог" },
    ],
  },
  {
    id: "projection",
    label: "Прогноз",
    items: [
      { id: "proj_finalNw", label: "Итог NW" },
      { id: "proj_chart", label: "График NW" },
      { id: "proj_avgSurplus", label: "Средний профицит" },
    ],
  },
  {
    id: "insights",
    label: "Инсайты",
    items: [{ id: "insights_list", label: "Список инсайтов" }],
  },
  {
    id: "recommendations",
    label: "Рекомендации",
    items: [{ id: "recs_list", label: "Список рекомендаций" }],
  },
];

export const DEFAULT_REPORT_TEXTS: Record<ReportTextKey, string> = {
  title: "FinPlan — финансовый план (CFP)",
  disclaimer: REGULATORY_DISCLAIMER,
  executiveNarrative:
    "Краткий обзор текущего финансового положения и ключевых показателей плана. Ниже — точка 0, денежный поток, цели и прогноз.",
  insightsIntro: "Ключевые наблюдения по текущему профилю:",
  recommendationsIntro: "Приоритетные действия для укрепления плана:",
};

function allTrue<T extends string>(ids: readonly T[]): Record<T, boolean> {
  return Object.fromEntries(ids.map((id) => [id, true])) as Record<T, boolean>;
}

export function createDefaultReportConfig(): ReportConfig {
  const items = {} as Record<ReportItemId, boolean>;
  for (const block of REPORT_BLOCK_DEFS) {
    for (const item of block.items) {
      items[item.id] = true;
    }
  }
  return {
    blocks: allTrue(REPORT_BLOCK_IDS),
    items,
    texts: { ...DEFAULT_REPORT_TEXTS },
  };
}

export function isBlockEnabled(config: ReportConfig, id: ReportBlockId): boolean {
  return config.blocks[id] !== false;
}

export function isItemEnabled(
  config: ReportConfig,
  blockId: ReportBlockId,
  itemId: ReportItemId,
): boolean {
  return isBlockEnabled(config, blockId) && config.items[itemId] !== false;
}

export function mergeReportConfig(
  partial: Partial<ReportConfig> | null | undefined,
): ReportConfig {
  const base = createDefaultReportConfig();
  if (!partial) return base;
  return {
    blocks: { ...base.blocks, ...partial.blocks },
    items: { ...base.items, ...partial.items },
    texts: { ...base.texts, ...partial.texts },
  };
}

export const REPORT_CONFIG_STORAGE_KEY = "finplan.reportConfig.v1";
