/**
 * Next.js proxy — route protection.
 *
 * Checks for JWT token in localStorage via cookie (or header).
 * Since proxy runs on the server, we can't access localStorage directly.
 * Instead we check for the auth cookie set by the client.
 *
 * Strategy:
 *  - `/admin/*` routes → require auth → redirect to /login if no token
 *  - `/login` → redirect to /admin if already authenticated
 *  - Everything else → pass through
 *
 * Note: This is a lightweight check. The real auth validation happens
 * server-side (Spring Boot) when the JWT is sent with API requests.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.includes(".") // files with extensions (favicon, images, etc.)
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets
  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  // Read the auth token from cookie (set by client on login)
  const authToken = request.cookies.get("stockflow-auth-token")?.value;
  const isAuthenticated = !!authToken;

  // Protected routes: /admin/*
  if (pathname.startsWith("/admin") && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Already authenticated → redirect away from login
  if (isPublicPath(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
