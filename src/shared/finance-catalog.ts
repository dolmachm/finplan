import type { AssetType, LiabilityType, PortfolioSleeve } from "@/shared/types";
import { FREQUENCY_VALUES } from "@/modules/plan/frequency";

export const FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: "Ежемесячно",
  QUARTERLY: "Раз в квартал",
  SEMI_ANNUAL: "Раз в полгода",
  YEARLY: "Раз в год",
  ONE_TIME: "Единоразово",
};

export const FREQUENCY_OPTIONS = FREQUENCY_VALUES.map((v) => ({
  value: v,
  label: FREQUENCY_LABELS[v],
}));

export const ASSET_CLASS_LABELS = {
  PERSONAL: "Личный",
  INVESTMENT: "Инвестиционный",
} as const;

/** CFP portfolio sleeves (allocation classes inside an investment account) */
export const PORTFOLIO_SLEEVE_OPTIONS: Array<{
  value: PortfolioSleeve;
  label: string;
}> = [
  { value: "CASH_EQUIVALENT", label: "Денежные средства / эквиваленты" },
  { value: "FIXED_INCOME", label: "Облигации / фикс. доход" },
  { value: "EQUITY", label: "Акции / долевые" },
  { value: "REAL_ESTATE", label: "Недвижимость" },
  { value: "ALTERNATIVE", label: "Альтернативные" },
  { value: "COMMODITY", label: "Сырьё / товары" },
  { value: "OTHER", label: "Прочее" },
];

export function portfolioSleeveLabel(sleeve: string): string {
  return PORTFOLIO_SLEEVE_OPTIONS.find((o) => o.value === sleeve)?.label ?? sleeve;
}

export const ASSET_TYPE_OPTIONS: Array<{
  value: AssetType;
  label: string;
  class: keyof typeof ASSET_CLASS_LABELS;
}> = [
  { value: "CASH", label: "Наличные", class: "PERSONAL" },
  { value: "BANK_ACCOUNT", label: "Банковский счёт", class: "PERSONAL" },
  { value: "DEPOSIT", label: "Вклад", class: "PERSONAL" },
  { value: "REAL_ESTATE", label: "Недвижимость (личная)", class: "PERSONAL" },
  { value: "VEHICLE", label: "Автомобиль (личный)", class: "PERSONAL" },
  { value: "COLLECTIBLE", label: "Коллекционный актив", class: "PERSONAL" },
  { value: "BROKERAGE", label: "Брокерский счёт", class: "INVESTMENT" },
  { value: "IIS", label: "ИИС", class: "INVESTMENT" },
  { value: "MUTUAL_FUND", label: "ПИФ / фонд", class: "INVESTMENT" },
  { value: "CRYPTO", label: "Криптовалюта", class: "INVESTMENT" },
  { value: "CROWDFUNDING", label: "Краудинвестинг", class: "INVESTMENT" },
  { value: "RENTAL_REAL_ESTATE", label: "Недвижимость под сдачу", class: "INVESTMENT" },
  { value: "RENTAL_VEHICLE", label: "Авто под сдачу", class: "INVESTMENT" },
  { value: "OTHER", label: "Другое", class: "PERSONAL" },
];

export const INCOME_SOURCE_LABELS: Record<string, string> = {
  SALARY: "Зарплата",
  FREELANCE: "Фриланс",
  PASSIVE: "Пассивный",
  BUSINESS: "Бизнес",
  OTHER: "Другое",
};

export const LIABILITY_TYPE_OPTIONS: Array<{ value: LiabilityType; label: string }> = [
  { value: "MORTGAGE", label: "Ипотека" },
  { value: "CONSUMER_LOAN", label: "Потребительский кредит" },
  { value: "CREDIT_CARD", label: "Кредитная карта" },
  { value: "AUTO_LOAN", label: "Автокредит" },
  { value: "STUDENT_LOAN", label: "Образовательный кредит" },
  { value: "OTHER", label: "Другое" },
];

export function assetTypeLabel(type: string): string {
  return ASSET_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export function liabilityTypeLabel(type: string): string {
  return LIABILITY_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export function frequencyLabel(freq: string): string {
  return FREQUENCY_LABELS[freq] ?? freq;
}

export function essentialLabel(isEssential: boolean): string {
  return isEssential ? "Обязательный" : "Переменный";
}

/** Default expense envelopes seeded on first budget-categories GET */
export const DEFAULT_EXPENSE_CATEGORIES: Array<{ name: string; sortOrder: number }> = [
  { name: "Жильё", sortOrder: 0 },
  { name: "Еда", sortOrder: 1 },
  { name: "Транспорт", sortOrder: 2 },
  { name: "Здоровье", sortOrder: 3 },
  { name: "Связь", sortOrder: 4 },
  { name: "Развлечения", sortOrder: 5 },
  { name: "Одежда", sortOrder: 6 },
  { name: "Подписки", sortOrder: 7 },
  { name: "Прочее", sortOrder: 8 },
];

export function resolveAssetClass(
  type: AssetType | undefined,
  assetClass?: "PERSONAL" | "INVESTMENT",
): "PERSONAL" | "INVESTMENT" | undefined {
  if (assetClass) return assetClass;
  if (!type) return undefined;
  return ASSET_TYPE_OPTIONS.find((o) => o.value === type)?.class ?? "PERSONAL";
}
