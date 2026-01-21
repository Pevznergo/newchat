import NextAuth from "next-auth";
import { type NextRequest, NextResponse } from "next/server";
import { authConfig } from "./app/(auth)/auth.config";
import { guestRegex } from "./lib/constants";

export const { auth: middleware } = NextAuth(authConfig);

export default middleware((req) => {
  const { nextUrl } = req;
  const { pathname } = nextUrl;
  const isLoggedIn = !!req.auth;

  // 1. Ping Check (Playwright/Health check)
  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  // 2. Skip API routes that don't need protection or handle their own auth
  // /api/auth is handled by NextAuth
  // /api/telegram is the webhook
  // /api/payment is payment callbacks
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/telegram") ||
    pathname.startsWith("/api/payment")
  ) {
    return NextResponse.next();
  }

  // 3. Guest / Session Check
  if (!isLoggedIn) {
     // If not logged in, force guest creation via API
     const redirectUrl = encodeURIComponent(req.url);
     return NextResponse.redirect(
        new URL(`/api/auth/guest?redirectUrl=${redirectUrl}`, req.url)
     );
  }

  // 4. Admin Protection
  if (pathname.startsWith("/admin")) {
    const userEmail = req.auth?.user?.email?.toLowerCase();
    if (userEmail !== "pevznergo@gmail.com") {
        return Response.redirect(new URL("/?error=access_denied&from_middleware=true", nextUrl));
    }
  }

  // 5. Authenticated User Redirection from Login/Register
  // If user is logged in (and NOT a guest), redirect away from login pages
  const email = req.auth?.user?.email ?? "";
  const isGuest = guestRegex.test(email);

  if (!isGuest && ["/login", "/register"].includes(pathname)) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/",
    "/chat/:id",
    "/api/:path*",
    "/login",
    "/register",
    "/admin/:path*",
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
