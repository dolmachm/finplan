export type ValidationIssue = {
  field: string;
  message: string;
  fix: string;
};

type ApiErrorBody = {
  error?: string;
  issues?: ValidationIssue[];
};

export async function readApiError(res: Response): Promise<{
  message: string;
  issues: ValidationIssue[];
}> {
  const data = (await res.json().catch(() => ({}))) as ApiErrorBody;
  const issues = data.issues ?? [];
  if (issues.length) {
    return {
      message: issues.map((i) => `${i.message}. ${i.fix}`).join(" "),
      issues,
    };
  }
  return {
    message: data.error ?? `Ошибка сервера (${res.status})`,
    issues: [],
  };
}

export function issuesByField(
  issues: ValidationIssue[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of issues) {
    map[issue.field] = `${issue.message}. ${issue.fix}`;
  }
  return map;
}

export function parsePositiveNumber(
  value: string,
  label: string,
): { ok: true; value: number } | { ok: false; message: string } {
  const trimmed = value.trim();
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
