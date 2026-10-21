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

/** Mở khoá hoặc mở lại khách đã đóng bắt buộc lý do (BE 400 nếu trống). */
export const REASON_REQUIRED: ReadonlySet<CustomerStatusAction> = new Set(["reactivate", "reopen"]);

/**
 * Đổi trạng thái: `customer-status:APPROVE` VÀ vai trò ECOMMERCE_ADMIN (hoặc SYSTEM_ADMIN).
 * Resource riêng chặn Sales đổi trạng thái dù họ có quyền duyệt khách ở resource khác.
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
 * Trạng thái lời mời portal: BE yêu cầu customer-customers:READ và tài khoản back-office.
 * UI-only — Backend phải re-check.
 */
export function canViewInvitation(
  can: (code: PermissionCode) => boolean,
  roles: readonly string[],
): boolean {
  return can(CUSTOMER_PERMISSIONS.read) && roles.some((role) => role !== STAFF_ROLE.CUSTOMER);
}
