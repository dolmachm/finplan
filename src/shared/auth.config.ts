import type { NextAuthConfig } from "next-auth";

export function resolveAuthSecret(): string | undefined {
  const raw =
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    undefined;
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isAuthConfigured(): boolean {
  return getAuthSecret().length > 0;
}

/**
 * Секрет JWT NextAuth. В production отсутствие AUTH_SECRET — жёсткая ошибка
 * (пустая строка больше не допускается).
 */
export function getAuthSecret(): string {
  const secret = resolveAuthSecret();
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") {
    return "dev-auth-secret-change-me";
  }
  throw new Error(
    "AUTH_SECRET (or NEXTAUTH_SECRET) is required in production",
  );
}

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;

      if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", request.nextUrl));
        }
        return true;
      }

      if (pathname.startsWith("/dashboard")) {
        return isLoggedIn;
      }

      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "USER";
        token.name = user.name ?? "";
        token.email = user.email ?? undefined;
      }
      if (trigger === "update" && session) {
        const s = session as { name?: string | null; email?: string | null };
        if (s.name !== undefined) token.name = s.name ?? "";
        if (s.email !== undefined) token.email = s.email ?? undefined;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        if (typeof token.name === "string") {
          session.user.name = token.name || null;
        }
        if (typeof token.email === "string") {
          session.user.email = token.email;
        }
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
