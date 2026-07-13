import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const ADMIN_COOKIE = "admin_session";
const ADMIN_LOGIN = "admin";
const ADMIN_PASSWORD = "12345";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function getSecret() {
  return process.env.AUTH_SECRET ?? "dev-admin-secret";
}

export function verifyAdminCredentials(login: string, password: string) {
  return login === ADMIN_LOGIN && password === ADMIN_PASSWORD;
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
  const expected = signPayload(payload);

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
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
