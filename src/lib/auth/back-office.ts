/**
 * Ai được vào khu back-office (`/admin/**`) — gương của BE `ScopeGuards#requireBackOffice`, TÁCH
 * khỏi quyền theo trang. Khách hàng giữ một số quyền giống nhân viên (vd `sales-orders:READ` cho
 * đơn của chính mình) nên quyền tính năng KHÔNG dùng để phân biệt được.
 *
 * Đọc vai trò từ `GET /identity/me/permissions` (`MyPermissionsResponse.roles` — mã vai trò BE, cả
 * khi chạy mock). UI-only: BE vẫn tự chặn từng endpoint.
 */

import { BACKOFFICE_ROLES } from "@/constants/permissions";

import type { MyPermissions } from "./me-permissions";

const BACKOFFICE_ROLE_SET: ReadonlySet<string> = new Set(BACKOFFICE_ROLES);

/** Có ít nhất một vai trò back-office BE biết tên. Chưa tải / không có vai trò → false. */
export function isBackOfficeActor(perms: Pick<MyPermissions, "roles"> | undefined): boolean {
  return perms?.roles.some((role) => BACKOFFICE_ROLE_SET.has(role)) ?? false;
}
