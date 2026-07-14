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
  return Boolean(resolveAuthSecret());
}

export function getAuthSecret(): string {
  const secret = resolveAuthSecret();
  if (secret) return secret;
  // Dev-only fallback so local `next build` / middleware can boot.
  if (process.env.NODE_ENV !== "production") {
    return "dev-auth-secret-change-me";
  }
  // Production without env: non-empty placeholder so module loads;
  // route handlers gate with isAuthConfigured() → 503.
  return "missing-auth-secret-set-AUTH_SECRET";
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
