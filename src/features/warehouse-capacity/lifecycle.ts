/**
 * Bảng sức chứa kho chỉ để đọc — không có vòng đời trạng thái riêng (docs 06 §4.6: tính khi đọc, không lưu).
 * Hành động duy nhất là chỉnh **hệ số sử dụng** của kho (Quản lý kho — docs 06 §2, §4.6 bước 9), đi qua
 * `PUT /warehouses/{id}`. Quyền theo mã từ `/identity/me/permissions`, không theo tên vai trò.
 * UI-only — Backend phải re-check (`@RequiresPermission` warehouse-capacity:READ / warehouse-warehouses:UPDATE).
 */

import { WAREHOUSE_CAPACITY_PERMISSIONS, WAREHOUSE_LOCATION_PERMISSIONS } from "@/constants";

import type { PermissionCode } from "@/lib/auth";

export interface CapacityActor {
  can: (code: PermissionCode) => boolean;
}

export interface CapacityActions {
  /** Xem bảng (`GET /warehouse-capacity`). */
  read: boolean;
  /** Sửa hệ số sử dụng — đọc bản kho (`version`) rồi `PUT /warehouses/{id}`, nên cần cả READ lẫn UPDATE. */
  editFactor: boolean;
  /** Mở bản đồ kho để bổ sung chiều cao lọt của tầng / mở thêm bin (docs 06 §4.6 bước 9). */
  openMap: boolean;
}

export function capacityActions(actor: CapacityActor): CapacityActions {
  return {
    read: actor.can(WAREHOUSE_CAPACITY_PERMISSIONS.read),
    editFactor:
      actor.can(WAREHOUSE_CAPACITY_PERMISSIONS.warehouseRead) &&
      actor.can(WAREHOUSE_CAPACITY_PERMISSIONS.warehouseUpdate),
    openMap: actor.can(WAREHOUSE_LOCATION_PERMISSIONS.read),
  };
}
