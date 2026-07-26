"use client";

import { readApiError, NETWORK_ERROR_MESSAGE } from "@/shared/api-client";

type ApiFetchOptions = RequestInit & {
  /** По умолчанию true: при 401 уводим на /login (вместо prop-drilling onUnauthorized). */
  redirectOnUnauthorized?: boolean;
};

let unauthorizedRedirecting = false;

function redirectUnauthorized() {
  if (typeof window === "undefined") return;
  // Один редирект за сессию страницы — без гонки параллельных 401.
  if (unauthorizedRedirecting) return;
  unauthorizedRedirecting = true;
  const next = `/login?session=expired`;
  window.location.assign(next);
}

/**
 * Клиентский fetch поверх нативного: cache no-store по умолчанию,
 * при 401 — redirect на логин и null (вызывающий код просто выходит).
 */
export async function apiFetch(
  input: string,
  init?: ApiFetchOptions,
): Promise<Response | null> {
  const { redirectOnUnauthorized = true, ...rest } = init ?? {};
  try {
    const res = await fetch(input, {
      ...rest,
      cache: rest.cache ?? "no-store",
    });
    if (res.status === 401 && redirectOnUnauthorized) {
      redirectUnauthorized();
      return null;
    }
    return res;
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE);
  }
}

/** apiFetch + разбор JSON и readApiError в единый { ok, data | message }. */
export async function apiFetchJson<T>(
  input: string,
  init?: ApiFetchOptions,
): Promise<
  | { ok: true; data: T; res: Response }
  | { ok: false; message: string; issues?: unknown[]; res: Response | null }
> {
  try {
    const res = await apiFetch(input, init);
    if (!res) {
      return { ok: false, message: "Unauthorized", res: null };
    }
    if (!res.ok) {
      const { message, issues } = await readApiError(res);
      return { ok: false, message, issues, res };
    }
    const data = (await res.json()) as T;
    return { ok: true, data, res };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : NETWORK_ERROR_MESSAGE,
      res: null,
    };
  }
}
