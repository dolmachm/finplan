import type { AssetType } from "@/shared/types";
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

export function assetTypeLabel(type: string): string {
  return ASSET_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export function frequencyLabel(freq: string): string {
  return FREQUENCY_LABELS[freq] ?? freq;
}

export function essentialLabel(isEssential: boolean): string {
  return isEssential ? "Обязательный" : "Переменный";
}
