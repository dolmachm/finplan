import NextAuth from "next-auth";
import { authConfig, getAuthSecret } from "@/shared/auth.config";

export const { auth: middleware } = NextAuth({
  ...authConfig,
  secret: getAuthSecret(),
});

export default middleware;

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
