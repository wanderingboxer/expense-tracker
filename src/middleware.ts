import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Every API route already enforces its own auth (auth() + 401, or a
  // bearer-token check for server-to-server routes like /api/cron/sync).
  // Gating them here too with a session-cookie redirect is redundant for
  // cookie-authenticated calls and actively wrong for non-cookie ones —
  // Vercel Cron's request to /api/cron/sync carries only an Authorization
  // header, no session cookie, so this middleware was redirecting every
  // cron invocation to /login before the route's own check ever ran.
  const isApiRoute = pathname.startsWith("/api/");
  const isLoginPage = pathname === "/login";
  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt";

  if (isApiRoute || isLoginPage || isPublicAsset) {
    return NextResponse.next();
  }

  const sessionToken =
    request.cookies.get("authjs.session-token")?.value ??
    request.cookies.get("__Secure-authjs.session-token")?.value;

  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|favicon\\.ico|sitemap\\.xml|robots\\.txt).*)",
  ],
};
