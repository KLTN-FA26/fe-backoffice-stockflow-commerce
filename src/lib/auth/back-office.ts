/**
 * Ai được vào khu back-office (`/admin/**`) — phần UI tương ứng với BE `ScopeGuards#isBackOffice` /
 * `CurrentUser#isPortalCustomer` (develop): back-office ⇔ KHÔNG phải tài khoản cửa hàng. Đây là ranh giới
 * PHẠM VI DỮ LIỆU (dữ liệu của khách vs dữ liệu back-office), KHÔNG phải quyền thao tác: quyền xem trang /
 * làm hành động vẫn do mã quyền quyết định (`OrderPermissionGate`, `can()` …). Khách hàng giữ một số quyền
 * giống nhân viên (vd `sales-orders:READ` cho đơn của chính mình) nên quyền tính năng KHÔNG dùng để phân
 * biệt được.
 *
 * Đọc vai trò từ `GET /identity/me/permissions` (`MyPermissionsResponse.roles` — vai trò của token, GỒM CẢ
 * vai trò tự tạo, SCRUM-455). Không liệt kê vai trò nhân viên: nhân viên chỉ có vai trò tự tạo vẫn là
 * back-office, như BE. Ngoại lệ hẹp duy nhất của luật "không gắn cứng vai trò" (`no-role-gating.test.ts`).
 *
 * Cố ý chặt hơn BE (fail closed) ở hai trường hợp:
 * - không vai trò (chưa tải, phiên rỗng): BE coi là back-office, FE chặn;
 * - CUSTOMER kèm vai trò khác: tài khoản hợp lệ của BE không có (IdentityServiceImpl từ chối gán CUSTOMER
 *   cùng vai trò khác — ROLE_NOT_ASSIGNABLE), nên gặp thì coi là bất thường và chặn.
 *
 * UI-only: BE vẫn tự chặn từng endpoint.
 */

import { PORTAL_CUSTOMER_ROLE } from "@/constants/permissions";

import type { MyPermissions } from "./me-permissions";

export function isBackOfficeActor(perms: Pick<MyPermissions, "roles"> | undefined): boolean {
  if (!perms?.roles.length) return false;
  return !perms.roles.includes(PORTAL_CUSTOMER_ROLE);
}
