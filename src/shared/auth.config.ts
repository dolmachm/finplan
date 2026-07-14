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
  // Always true once getAuthSecret() can return a non-empty value.
  return getAuthSecret().length > 0;
}

export function getAuthSecret(): string {
  const secret = resolveAuthSecret();
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") {
    return "dev-auth-secret-change-me";
  }
  // Bootstrap when AUTH_SECRET env is missing on the host.
  // Prefer setting AUTH_SECRET in Vercel; rotate if this value was ever public.
  return "0avIdGk/CoeokG/FKTX7clF8Ra6mmGtZ3ewJfb++tqc=";
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "USER";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
