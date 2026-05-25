import { auth } from "@/shared/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage =
    req.nextUrl.pathname.startsWith("/login") ||
    req.nextUrl.pathname.startsWith("/register");
  const isPublic =
    req.nextUrl.pathname === "/" ||
    req.nextUrl.pathname.startsWith("/api/auth") ||
    req.nextUrl.pathname.startsWith("/how-it-works");

  if (!isLoggedIn && req.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }
  if (!isLoggedIn && !isPublic && !isAuthPage && req.nextUrl.pathname.startsWith("/api")) {
    const publicApi = ["/api/auth"];
    if (!publicApi.some((p) => req.nextUrl.pathname.startsWith(p))) {
      // API routes handle auth themselves
    }
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
