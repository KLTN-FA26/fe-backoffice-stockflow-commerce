/**
 * Điều hướng sau đăng nhập — một chỗ cho login page, AuthGuard và layout hai khu vực.
 *
 * Hai khu vực dùng chung phiên BFF: back-office `/admin` (nhân viên) và portal khách `/portal`
 * (tài khoản chỉ có vai trò CUSTOMER — SCRUM-450/451). Đây là điều hướng UX, KHÔNG phải phân
 * quyền: BE re-check mọi request (@RequiresPermission).
 */

import { ADMIN_ROUTES, PORTAL_ROUTES, STAFF_ROLE } from "@/constants";

export type AppArea = "admin" | "portal";

function inArea(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}/`) || path.startsWith(`${base}?`);
}

/**
 * `callbackUrl` chỉ nhận đường dẫn nội bộ thuộc `/admin` hoặc `/portal` (không `//host`, không
 * `\\`, không trang kích hoạt) — tránh open redirect.
 */
export function safeCallbackUrl(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  if (inArea(raw, PORTAL_ROUTES.activate)) return null;
  if (inArea(raw, ADMIN_ROUTES.home) || inArea(raw, PORTAL_ROUTES.home)) return raw;
  return null;
}

export function areaOf(path: string): AppArea | null {
  if (inArea(path, ADMIN_ROUTES.home)) return "admin";
  if (inArea(path, PORTAL_ROUTES.home)) return "portal";
  return null;
}

/** Tài khoản portal = chỉ có vai trò CUSTOMER (BE `Roles.CUSTOMER`). */
export function isCustomerOnly(roles: readonly string[]): boolean {
  return roles.length > 0 && roles.every((role) => role === STAFF_ROLE.CUSTOMER);
}

export function homeAreaFor(roles: readonly string[]): AppArea {
  return isCustomerOnly(roles) ? "portal" : "admin";
}

export function homeFor(roles: readonly string[]): string {
  return homeAreaFor(roles) === "portal" ? PORTAL_ROUTES.home : ADMIN_ROUTES.home;
}

/** Callback hợp lệ và cùng khu vực với tài khoản → giữ; ngược lại về trang chủ khu vực đó. */
export function landingFor(roles: readonly string[], callback: string | null | undefined): string {
  const safe = safeCallbackUrl(callback);
  if (safe && areaOf(safe) === homeAreaFor(roles)) return safe;
  return homeFor(roles);
}

/** `/login?callbackUrl=<đường dẫn hiện tại>` — quay lại đúng trang + bộ lọc sau khi đăng nhập. */
export function loginUrlFor(currentPath: string | null | undefined): string {
  const safe = safeCallbackUrl(currentPath);
  return safe ? `/login?callbackUrl=${encodeURIComponent(safe)}` : "/login";
}
