/**
 * Selector thuần của màn Thùng hàng (LPN) — link từ một thùng sang nơi xử lý nó. Thùng ở kho nào thì mở trong tab Kho
 * của kho đó (prefix = `warehouseCode`, BE: mã kho là tiền tố mã vị trí).
 */

import { ADMIN_ROUTES, CARTON_OPEN_TASK_TYPES, WORKSPACE_PATHS } from "@/constants";

import type { CartonOpenTaskType } from "@/constants";

export const isOpenTaskType = (value: string): value is CartonOpenTaskType =>
  CARTON_OPEN_TASK_TYPES.some((type) => type === value);

const TASK_PATH: Record<CartonOpenTaskType, (id: string) => string> = {
  PUTAWAY: WORKSPACE_PATHS.putawayTask,
  PICK: WORKSPACE_PATHS.pickingTask,
  // BE gửi id task lấy hàng cho kiểm thùng (phiên kiểm thùng là của task lấy hàng) — trạm kiểm thùng mở theo id đó
  CARTON_CHECK: WORKSPACE_PATHS.packingTask,
  CYCLE_COUNT: WORKSPACE_PATHS.cycleCount,
};

/** Link mở việc đang làm trên thùng (docs 20 BR-10: thùng bận); loại lạ / thiếu kho → null, chỉ hiện nhãn. */
export function openTaskHref(
  task: { type: string; id: string },
  warehouseCode: string | null | undefined,
): string | null {
  if (!warehouseCode || !isOpenTaskType(task.type)) return null;
  return ADMIN_ROUTES.warehouseMap.page(warehouseCode, TASK_PATH[task.type](task.id));
}

/** Vị trí của thùng trên Danh sách vị trí của kho, lọc sẵn đúng mã (`?code=` của `useLocationFilters`). */
export function cartonLocationHref(
  warehouseCode: string | null | undefined,
  locationCode: string | null | undefined,
): string | null {
  if (!warehouseCode || !locationCode) return null;
  const page = ADMIN_ROUTES.warehouseMap.page(warehouseCode, WORKSPACE_PATHS.locations);
  return `${page}?code=${encodeURIComponent(locationCode)}`;
}
