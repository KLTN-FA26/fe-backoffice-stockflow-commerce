/**
 * Vòng đời khách hàng — chép từ BE `Customer.changeStatus/reopen` (d215f6e) và handoff
 * SCRUM-429 (docs 18 §5): Pending Activation → Closed; Active ↔ Suspended; → Closed;
 * Closed → Active (mở lại, lý do bắt buộc — quyết định 2026-10-12).
 * Không ai được đặt PENDING_ACTIVATION thủ công. UI-only — Backend phải re-check.
 */

import { CUSTOMER_PERMISSIONS, STAFF_ROLE } from "@/constants";

import type { CustomerApiStatus } from "@/constants";
import type { PermissionCode } from "@/lib/auth/me-permissions";

export type CustomerStatusAction = "suspend" | "reactivate" | "close" | "reopen";

export const CUSTOMER_TRANSITIONS: Readonly<
  Record<CustomerApiStatus, readonly CustomerStatusAction[]>
> = {
  PENDING_ACTIVATION: ["close"],
  ACTIVE: ["suspend", "close"],
  BLOCKED: ["reactivate", "close"],
  INACTIVE: ["reopen"],
};

export const CUSTOMER_ACTION_TARGET: Readonly<
  Record<CustomerStatusAction, Exclude<CustomerApiStatus, "PENDING_ACTIVATION">>
> = {
  suspend: "BLOCKED",
  reactivate: "ACTIVE",
  close: "INACTIVE",
  reopen: "ACTIVE",
};

/** Mở lại khách đã đóng bắt buộc lý do (BE 400 nếu trống); các thao tác khác lý do tuỳ chọn. */
export const REASON_REQUIRED: ReadonlySet<CustomerStatusAction> = new Set(["reopen"]);

/**
 * Đổi trạng thái: `customer-customers:APPROVE` VÀ vai trò ECOMMERCE_ADMIN (hoặc SYSTEM_ADMIN) —
 * BE CustomerController.changeStatus kiểm tra thêm vai trò; Sales có APPROVE vẫn bị 403.
 */
export function canChangeCustomerStatus(
  can: (code: PermissionCode) => boolean,
  roles: readonly string[],
): boolean {
  return (
    can(CUSTOMER_PERMISSIONS.approve) &&
    roles.some((role) => role === STAFF_ROLE.ECOMMERCE_ADMIN || role === STAFF_ROLE.SYSTEM_ADMIN)
  );
}

/** Gửi lại lời mời: CREATE + khách còn chờ kích hoạt (BE 409 CONFLICT nếu không). */
export function canResendInvitation(
  status: CustomerApiStatus,
  can: (code: PermissionCode) => boolean,
): boolean {
  return status === "PENDING_ACTIVATION" && can(CUSTOMER_PERMISSIONS.create);
}

export function allowedCustomerActions(
  status: CustomerApiStatus,
  canChangeStatus: boolean,
): readonly CustomerStatusAction[] {
  return canChangeStatus ? CUSTOMER_TRANSITIONS[status] : [];
}

/**
 * Trạng thái lời mời portal: BE `GET /customers/{id}/portal-invitation` thêm role check
 * SALES_STAFF / ECOMMERCE_ADMIN (SYSTEM_ADMIN luôn qua). UI-only — Backend phải re-check.
 */
export function canViewInvitation(roles: readonly string[]): boolean {
  return roles.some(
    (role) =>
      role === STAFF_ROLE.SALES_STAFF ||
      role === STAFF_ROLE.ECOMMERCE_ADMIN ||
      role === STAFF_ROLE.SYSTEM_ADMIN,
  );
}
