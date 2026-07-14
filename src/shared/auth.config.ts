import type { NextAuthConfig } from "next-auth";

function resolveAuthSecret(): string | undefined {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
}

/** True only when a real secret is configured (not a local/dev fallback). */
export function isAuthConfigured(): boolean {
  return Boolean(resolveAuthSecret());
}

/**
 * NextAuth requires a non-empty secret at init.
 * Production without AUTH_SECRET still needs a value so the module can load;
 * handlers return 503 via isAuthConfigured() until env is set.
 */
export function getAuthSecret(): string {
  return (
    resolveAuthSecret() ??
    (process.env.NODE_ENV === "production"
      ? "missing-auth-secret-set-AUTH_SECRET"
      : "dev-auth-secret-change-me")
  );
}

export const authConfig = {
  secret: getAuthSecret(),
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
