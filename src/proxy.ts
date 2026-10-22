/** Cookie presence is a routing hint; the BFF/backend validate the session. */

import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, LEGACY_AUTH_COOKIE_NAME } from "@/constants/auth";
import { ADMIN_ROUTES, APP_ROUTES, PORTAL_ROUTES } from "@/constants/routes";

import { safeCallbackUrl } from "@/lib/auth/redirect";
import { expireLegacyCookie } from "@/lib/auth/server/cookie";

import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password"];
/** Back-office (Mode A) và portal khách hàng (Mode B) đều cần phiên. */
const PROTECTED_PREFIXES = [ADMIN_ROUTES.home, PORTAL_ROUTES.home];
/** Trang kích hoạt từ email mời: khách chưa có mật khẩu → không thể có phiên (SCRUM-451). */
const PORTAL_ACTIVATION_PATH = PORTAL_ROUTES.activate;

function isProtectedPath(pathname: string): boolean {
  if (pathname.replace(/\/+$/, "") === PORTAL_ACTIVATION_PATH) return false;
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

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
  // Clear the old readable cookie on page entry, including public pages.
  const finalize = (response: NextResponse) =>
    request.cookies.has(LEGACY_AUTH_COOKIE_NAME) ? expireLegacyCookie(response) : response;

  // Skip static assets
  if (isStaticAsset(pathname)) {
    return finalize(NextResponse.next());
  }

  // Read the server-issued HttpOnly routing hint.
  const authToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isAuthenticated = !!authToken;

  // Protected routes: /admin/*, /portal/* — giữ cả query để quay lại đúng bộ lọc sau đăng nhập
  if (isProtectedPath(pathname) && !isAuthenticated) {
    const loginUrl = new URL(APP_ROUTES.login, request.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${request.nextUrl.search}`);
    return finalize(NextResponse.redirect(loginUrl));
  }

  // Already authenticated → leave login; honour a safe callback (refresh right after login
  // would otherwise bounce to /admin and lose the page the user came from). Role-based area
  // correction (customer → /portal) happens client-side in AreaGate.
  if (isPublicPath(pathname) && isAuthenticated) {
    const callback =
      safeCallbackUrl(request.nextUrl.searchParams.get("callbackUrl")) ?? ADMIN_ROUTES.home;
    return finalize(NextResponse.redirect(new URL(callback, request.url)));
  }

  return finalize(NextResponse.next());
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
