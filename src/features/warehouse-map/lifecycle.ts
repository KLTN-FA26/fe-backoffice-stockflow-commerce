/**
 * Trạng thái kệ / bin / khu vực và quyền thao tác trên bản đồ kho (docs 06 §5). Bốn trạng thái chuyển
 * qua lại tự do; ra khỏi INACTIVE đòi chỗ trên bản đồ còn trống — BE kiểm (409 LAYOUT_OVERLAP).
 * Quyền theo mã từ `/identity/me/permissions`, không theo tên vai trò. UI-only — Backend phải re-check
 * (`@RequiresPermission` warehouse-locations / warehouse-warehouses).
 */

import {
  LOCATION_STATUSES,
  WAREHOUSE_LOCATION_PERMISSIONS,
  WAREHOUSE_PERMISSIONS,
} from "@/constants";

import type { PermissionCode } from "@/lib/auth";
import type { LocationStatus } from "./types";

export interface WarehouseMapActor {
  can: (code: PermissionCode) => boolean;
}

/**
 * Bảng "Chuyển tiếp cho phép" docs 06 §5: Active ⇄ Blocked ⇄ Maintenance, cả ba → Inactive,
 * Inactive → Active (khi chỗ còn trống). Không có trạng thái kết thúc — kệ / khu vực không xoá (BR-04).
 */
export const LOCATION_STATUS_TRANSITIONS = {
  ACTIVE: ["BLOCKED", "MAINTENANCE", "INACTIVE"],
  BLOCKED: ["ACTIVE", "MAINTENANCE", "INACTIVE"],
  MAINTENANCE: ["ACTIVE", "BLOCKED", "INACTIVE"],
  INACTIVE: ["ACTIVE"],
} as const satisfies Record<LocationStatus, readonly LocationStatus[]>;

export interface WarehouseMapActions {
  /** Khai báo kho mới (`POST /warehouses`). */
  createWarehouse: boolean;
  /** Thêm zone / kệ / tầng / bin / khu vực / tường-cửa. */
  editLayout: boolean;
  /** Xoá tường / cửa — thứ duy nhất xoá hẳn được trên bản đồ (BR-04). */
  deleteBoundary: boolean;
}

export function warehouseMapActions(actor: WarehouseMapActor): WarehouseMapActions {
  return {
    createWarehouse: actor.can(WAREHOUSE_PERMISSIONS.create),
    editLayout: actor.can(WAREHOUSE_LOCATION_PERMISSIONS.create),
    deleteBoundary: actor.can(WAREHOUSE_LOCATION_PERMISSIONS.delete),
  };
}

/** Trạng thái đích của một kệ / khu vực; rỗng khi thiếu quyền cập nhật. */
export function placeStatusTargets(
  status: LocationStatus,
  actor: WarehouseMapActor,
): readonly LocationStatus[] {
  if (!actor.can(WAREHOUSE_LOCATION_PERMISSIONS.update)) return [];
  return LOCATION_STATUS_TRANSITIONS[status];
}

/** Mọi trạng thái đều có trong bảng — dùng cho test phủ đủ vòng đời. */
export const ALL_LOCATION_STATUSES = LOCATION_STATUSES;
