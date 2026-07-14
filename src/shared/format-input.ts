export function formatMoneyInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ru-RU");
}

export function digitsOnly(value: string, maxLen?: number): string {
  const digits = value.replace(/\D/g, "");
  return maxLen ? digits.slice(0, maxLen) : digits;
}
