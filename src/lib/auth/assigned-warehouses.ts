/**
 * Kho được gán của người đang đăng nhập — đọc từ `GET /identity/me/permissions` (BE #394).
 *
 * Docs 00: role phạm vi `WAREHOUSE` (NV kho, Quản lý kho) chỉ làm việc trong các kho được gán; role phạm vi khác không
 * bị `WarehouseScope` giới hạn theo kho. BE chưa trả danh sách → `unknown`: FE cho vào, BE chặn bằng 403 như trước.
 *
 * UI-only: chỉ để ẩn / chặn màn. Backend phải re-check (BR-SEC-002 `WarehouseScope`).
 */

import { useMyPermissions } from "./me-permissions";

import type { MyPermissions } from "./me-permissions";

export type AssignedScope = "restricted" | "all" | "unknown";

export interface AssignedWarehouse {
  id: string;
  prefix: string;
}

export interface AssignedWarehouses {
  scope: AssignedScope;
  warehouses: readonly AssignedWarehouse[];
}

export function assignedScopeOf(perms: MyPermissions | undefined): AssignedWarehouses {
  if (!perms) return { scope: "unknown", warehouses: [] };
  if (perms.dataScope !== "WAREHOUSE") return { scope: "all", warehouses: [] };
  if (!perms.warehouses) return { scope: "unknown", warehouses: [] };
  return { scope: "restricted", warehouses: perms.warehouses };
}

/** Prefix kho duy nhất, không đổi (06 BR-10/BR-13) — so khớp không phân biệt hoa thường. */
export function canEnterWarehouse(assigned: AssignedWarehouses, prefix: string): boolean {
  if (assigned.scope !== "restricted") return true;
  const wanted = prefix.toUpperCase();
  return assigned.warehouses.some((warehouse) => warehouse.prefix.toUpperCase() === wanted);
}

export function useAssignedWarehouses(): AssignedWarehouses & { isLoading: boolean } {
  const query = useMyPermissions();
  return { ...assignedScopeOf(query.data), isLoading: query.isLoading };
}
