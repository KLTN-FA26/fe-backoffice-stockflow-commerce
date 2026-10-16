/**
 * Supplier — vòng đời trạng thái + action-gating theo mã quyền thật.
 *
 * Trạng thái NCC: Active ↔ Inactive, và Blacklisted (BE SupplierStatus, PR #71).
 *  - Kích hoạt lại = PUT có status ACTIVE → cần `procurement-suppliers:UPDATE`.
 *  - Ngừng hợp tác = DELETE → cần `procurement-suppliers:DELETE`; còn PO mở BE trả 409.
 *  - Đưa vào danh sách đen = PUT có status BLACKLISTED → cần UPDATE. Như INACTIVE (không nhận PO
 *    mới) nhưng có lý do không hợp tác lại; gỡ ra = kích hoạt lại.
 * Quyền lấy từ `/identity/me/permissions` (BE PR #39), không theo tên vai trò.
 * UI-only: chỉ ẩn/hiện nút. // Backend phải re-check (BE @RequiresPermission + open-PO guard)
 */

import { SUPPLIER_PERMISSIONS } from "@/constants";

import type { PermissionCode } from "@/lib/auth";
import type { SupplierStatus } from "./types";

export const SUPPLIER_TRANSITIONS: Record<SupplierStatus, SupplierStatus[]> = {
  Active: ["Inactive", "Blacklisted"],
  Inactive: ["Active", "Blacklisted"],
  Blacklisted: ["Active"],
};

export type SupplierActionKey = "activate" | "deactivate" | "blacklist";

export interface SupplierActionDescriptor {
  key: SupplierActionKey;
  label: string;
  targetStatus: SupplierStatus;
  permission: PermissionCode;
}

const ACTION_BY_TARGET: Record<SupplierStatus, Omit<SupplierActionDescriptor, "targetStatus">> = {
  Active: { key: "activate", label: "Kích hoạt lại", permission: SUPPLIER_PERMISSIONS.update },
  Inactive: {
    key: "deactivate",
    label: "Ngừng hợp tác",
    permission: SUPPLIER_PERMISSIONS.delete,
  },
  Blacklisted: {
    key: "blacklist",
    label: "Đưa vào danh sách đen",
    permission: SUPPLIER_PERMISSIONS.update,
  },
};

/** Hành động hợp lệ theo trạng thái **và** quyền. `can` = hàm kiểm tra mã quyền. */
export function allowedSupplierActions(
  status: SupplierStatus,
  can: (code: PermissionCode) => boolean,
): SupplierActionDescriptor[] {
  return SUPPLIER_TRANSITIONS[status]
    .map((target) => ({ ...ACTION_BY_TARGET[target], targetStatus: target }))
    .filter((action) => can(action.permission));
}

/** Alias theo tên chuẩn của feature-architecture.md. */
export const allowedActions = allowedSupplierActions;
