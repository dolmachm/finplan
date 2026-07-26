import { forbiddenResponse } from "@/shared/api-validation";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Отдельная cookie-сессия админки (не NextAuth).
 * Логин/пароль только из ADMIN_LOGIN / ADMIN_PASSWORD;
 * в production без env вход закрыт (пустые строки → verify = false).
 */

export const ADMIN_COOKIE = "admin_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function getSecret() {
  const secret =
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "";
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") {
    return "dev-admin-secret";
  }
  // Prod без секрета — не подписываем токены слабым дефолтом.
  throw new Error("AUTH_SECRET is required in production for admin sessions");
}

function getAdminLogin(): string {
  const fromEnv = process.env.ADMIN_LOGIN?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV !== "production") return "admin";
  return "";
}

function getAdminPassword(): string {
  const fromEnv = process.env.ADMIN_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV !== "production") return "12345";
  return "";
}

/** Сравнение логина/пароля с timing-safe equal; без env в prod всегда false. */
export function verifyAdminCredentials(login: string, password: string) {
  const expectedLogin = getAdminLogin();
  const expectedPassword = getAdminPassword();
  if (!expectedLogin || !expectedPassword) return false;
  if (login.length !== expectedLogin.length) return false;
  if (password.length !== expectedPassword.length) return false;
  try {
    const loginOk = timingSafeEqual(
      Buffer.from(login),
      Buffer.from(expectedLogin),
    );
    const passOk = timingSafeEqual(
      Buffer.from(password),
      Buffer.from(expectedPassword),
    );
    return loginOk && passOk;
  } catch {
    return false;
  }
}

function signPayload(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createAdminToken() {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `admin:${expiresAt}`;
  return `${payload}.${signPayload(payload)}`;
}

export function verifyAdminToken(token: string) {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;

  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let expected: string;
  try {
    expected = signPayload(payload);
  } catch {
    return false;
  }

  try {
    const sigBuf = Buffer.from(sig, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expectedBuf.length) return false;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return false;
  } catch {
    return false;
  }

  const expiresAt = Number(payload.split(":")[1]);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export async function isAdminAuthenticated() {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  return token ? verifyAdminToken(token) : false;
}

export function setAdminCookie(response: NextResponse, token: string) {
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearAdminCookie(response: NextResponse) {
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function requireAdmin(): Promise<true | NextResponse> {
  if (await isAdminAuthenticated()) return true;
  return forbiddenResponse();
}
