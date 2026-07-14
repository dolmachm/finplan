import type { GoalStrategy, GoalType } from "@/shared/types";

export const GOAL_TYPE_OPTIONS: Array<{ value: GoalType; label: string }> = [
  { value: "RETIREMENT", label: "Пенсия" },
  { value: "EDUCATION", label: "Образование" },
  { value: "HOME", label: "Жильё" },
  { value: "EMERGENCY", label: "Резерв / подушка" },
  { value: "MAJOR_PURCHASE", label: "Крупная покупка" },
  { value: "WEALTH", label: "Накопление капитала" },
  { value: "LEGACY", label: "Наследие / передача" },
  { value: "OTHER", label: "Другое" },
];

export const GOAL_STRATEGY_OPTIONS: Array<{ value: GoalStrategy; label: string }> = [
  { value: "SYSTEMATIC", label: "Систематические взносы" },
  { value: "LUMP_SUM", label: "Единовременное финансирование" },
  { value: "BALANCED", label: "Смешанная стратегия" },
];

export function goalTypeLabel(type: string): string {
  return GOAL_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export function goalStrategyLabel(strategy: string): string {
  return GOAL_STRATEGY_OPTIONS.find((o) => o.value === strategy)?.label ?? strategy;
}

export function formatGoalDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("ru-RU", { year: "numeric", month: "short" });
}
