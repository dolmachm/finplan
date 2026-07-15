import { NextResponse } from "next/server";
import { z } from "zod";

export type ValidationIssue = {
  field: string;
  message: string;
  fix: string;
};

const FIELD_LABELS: Record<string, string> = {
  email: "Email",
  password: "Пароль",
  name: "Название",
  amount: "Сумма",
  currentValue: "Стоимость",
  targetAmountNominal: "Целевая сумма",
  targetDate: "Дата цели",
  category: "Категория",
  monthlyLimit: "Месячный лимит",
  kind: "Тип категории",
  source: "Источник",
  type: "Тип",
  numRuns: "Количество прогонов",
  scenarioId: "Сценарий",
  inflationPct: "Инфляция",
  baseInflationPct: "Инфляция",
  incomeTaxPct: "НДФЛ / налог на доход",
  taxCapitalGainsPct: "Налог на доход с капитала",
  taxDividendsPct: "Налог на дивиденды",
  discountRatePct: "Ставка дисконтирования",
  planningHorizonYears: "Горизонт планирования",
  planHorizonYears: "Горизонт планирования",
  remainingBalance: "Остаток долга",
  interestRatePct: "Процентная ставка",
  monthlyPayment: "Ежемесячный платёж",
  expectedReturnPct: "Ожидаемая доходность",
  volatilityPct: "Риск (волатильность)",
  priority: "Приоритет",
  goalType: "Тип цели",
  strategy: "Стратегия",
  frequency: "Периодичность",
  description: "Описание",
  params: "Параметры",
  rules: "Правила",
  templateKey: "Шаблон сценария",
};

export function notFoundResponse() {
  return NextResponse.json(
    { error: "Запись не найдена или у вас нет к ней доступа" },
    { status: 404 },
  );
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Войдите в аккаунт, чтобы продолжить" },
    { status: 401 },
  );
}

export function forbiddenResponse() {
  return NextResponse.json(
    { error: "Недостаточно прав для этого действия" },
    { status: 403 },
  );
}

function fieldLabel(path: PropertyKey[]): string {
  const parts = path.map(String);
  const key = parts.join(".");
  const last = parts.length ? parts[parts.length - 1] : "form";
  return FIELD_LABELS[last] ?? FIELD_LABELS[key] ?? last;
}

export function formatZodIssues(issues: z.core.$ZodIssue[]): ValidationIssue[] {
  return issues.map((issue) => {
    const field = issue.path.map(String).join(".") || "form";
    const label = fieldLabel(issue.path);

    switch (issue.code) {
      case "invalid_type": {
        const expected = "expected" in issue ? String(issue.expected) : "корректное значение";
        if (expected === "number") {
          return {
            field,
            message: `${label}: нужно число`,
            fix: "Введите число без букв, например 50000",
          };
        }
        if (expected === "string") {
          return {
            field,
            message: `${label}: нужен текст`,
            fix: "Заполните поле текстом",
          };
        }
        return {
          field,
          message: `${label}: неверный формат`,
          fix: `Ожидается ${expected}`,
        };
      }
      case "too_small": {
        const min = "minimum" in issue ? issue.minimum : undefined;
        const isString =
          "origin" in issue && issue.origin === "string";
        if (isString) {
          return {
            field,
            message: `${label}: слишком короткое`,
            fix: `Минимум ${min ?? 1} символов`,
          };
        }
        return {
          field,
          message: `${label}: слишком мало`,
          fix: `Значение должно быть не меньше ${min ?? 0}`,
        };
      }
      case "too_big": {
        const max = "maximum" in issue ? issue.maximum : undefined;
        return {
          field,
          message: `${label}: слишком большое`,
          fix: `Значение должно быть не больше ${max ?? "лимита"}`,
        };
      }
      case "invalid_format":
        return {
          field,
          message: `${label}: неверный формат`,
          fix: field === "email" ? "Введите email вида name@example.com" : "Проверьте формат значения",
        };
      case "invalid_value":
        return {
          field,
          message: `${label}: недопустимое значение`,
          fix: "Выберите значение из списка допустимых",
        };
      default:
        return {
          field,
          message: `${label}: ошибка валидации`,
          fix: issue.message || "Исправьте значение и попробуйте снова",
        };
    }
  });
}

export function validationErrorResponse(issues: z.core.$ZodIssue[]) {
  return NextResponse.json(
    { error: "Некорректные данные", issues: formatZodIssues(issues) },
    { status: 400 },
  );
}

export function parseJsonBody<T>(
  schema: z.ZodType<T>,
  body: unknown,
): { ok: true; data: T } | { ok: false; response: NextResponse } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return { ok: false, response: validationErrorResponse(result.error.issues) };
  }
  return { ok: true, data: result.data };
}

export function isZodError(e: unknown): e is z.ZodError {
  return e instanceof z.ZodError;
}
