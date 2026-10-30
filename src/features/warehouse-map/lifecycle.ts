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
import type { DraftItem } from "./draft";
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
  /** Vào chế độ sửa: vẽ zone / kệ / tầng / bin / khu vực / tường-cửa. */
  editLayout: boolean;
  /** Sửa / ngừng dùng hình đã lưu. */
  updateLayout: boolean;
  /** Xoá tường / cửa — thứ duy nhất xoá hẳn được trên bản đồ (BR-04). */
  deleteBoundary: boolean;
}

export function warehouseMapActions(actor: WarehouseMapActor): WarehouseMapActions {
  return {
    createWarehouse: actor.can(WAREHOUSE_PERMISSIONS.create),
    editLayout: actor.can(WAREHOUSE_LOCATION_PERMISSIONS.create),
    updateLayout: actor.can(WAREHOUSE_LOCATION_PERMISSIONS.update),
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

/* ── Chế độ sửa bản đồ: phần nào của hình đang chọn được sửa ─────────── */

/** Kết quả kiểm tồn của kệ / khu vực đang chọn (BR-04, C22: không dời / ngừng vị trí còn hàng). */
export type StockState = "free" | "checking" | "stocked" | "unknown";

/**
 * Phần nào của hình đang chọn được sửa. `identity`: tên, mô tả, zone, loại (BR-13 cho phép sửa).
 * `geometry`: vị trí, kích thước, xoay, mặt lấy hàng, lớp lưu trữ, xoá — khoá khi vị trí còn hàng.
 */
export interface PlaceLocks {
  identity: boolean;
  geometry: boolean;
  remove: boolean;
}

export interface EditPermissions {
  /** `warehouse-locations:UPDATE` — sửa / ngừng hình đã lưu. */
  update: boolean;
  /** `warehouse-locations:DELETE` — xoá tường / cửa đã lưu. */
  delete: boolean;
}

/** UI-only — Backend phải re-check quyền (`@RequiresPermission`) và luật vị trí. */
export function placeLocks(item: DraftItem, stock: StockState, can: EditPermissions): PlaceLocks {
  if (item.id === null) return { identity: false, geometry: false, remove: false };
  const noUpdate = !can.update;
  if (item.kind === "boundary")
    return { identity: noUpdate, geometry: noUpdate, remove: !can.delete };
  const busy = stock === "stocked" || stock === "checking";
  return { identity: noUpdate, geometry: noUpdate || busy, remove: noUpdate || busy };
}
