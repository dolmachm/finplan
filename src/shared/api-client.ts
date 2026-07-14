export type { ValidationIssue } from "@/shared/api-validation";
import type { ValidationIssue } from "@/shared/api-validation";

type ApiErrorBody = {
  error?: string;
  issues?: ValidationIssue[];
};

const EN_ERROR_MAP: Record<string, string> = {
  "Not found": "Запись не найдена или у вас нет к ней доступа",
  Unauthorized: "Войдите в аккаунт, чтобы продолжить",
  Forbidden: "Недостаточно прав для этого действия",
  "Validation failed":
    "Правила или данные некорректны. Исправьте выделенные пункты и попробуйте снова.",
};

export const NETWORK_ERROR_MESSAGE =
  "Не удалось связаться с сервером. Проверьте интернет и попробуйте снова.";

function friendlyError(message: string | undefined, status: number): string {
  if (!message) return `Не удалось выполнить действие (код ${status}). Попробуйте позже.`;
  return EN_ERROR_MAP[message] ?? message;
}

export async function readApiError(res: Response): Promise<{
  message: string;
  issues: ValidationIssue[];
}> {
  const data = (await res.json().catch(() => ({}))) as ApiErrorBody;
  const issues = data.issues ?? [];
  if (issues.length) {
    return {
      message: issues
        .map((i) =>
          "fix" in i && typeof (i as ValidationIssue).fix === "string"
            ? `${i.message}. ${(i as ValidationIssue).fix}`
            : i.message,
        )
        .join(" "),
      issues,
    };
  }
  return {
    message: friendlyError(data.error, res.status),
    issues: [],
  };
}

export function issuesByField(
  issues: ValidationIssue[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of issues) {
    map[issue.field] = issue.fix
      ? `${issue.message}. ${issue.fix}`
      : issue.message;
  }
  return map;
}

export function parsePositiveNumber(
  value: string,
  label: string,
): { ok: true; value: number } | { ok: false; message: string } {
  const trimmed = value.trim().replace(/\s/g, "");
  if (!trimmed) {
    return { ok: false, message: `${label}: укажите значение` };
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num)) {
    return {
      ok: false,
      message: `${label}: введите число, например 50000`,
    };
  }
  if (num < 0) {
    return { ok: false, message: `${label}: не может быть отрицательным` };
  }
  return { ok: true, value: num };
}
