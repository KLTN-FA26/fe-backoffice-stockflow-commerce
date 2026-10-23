"use client";

import { IDENTITY_PERMISSIONS, WAREHOUSE_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth";
import { useRoleOptions } from "@/lib/references/role-options";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";

import { isAssignableRole } from "./selectors";

import type { ChecklistItem } from "./components/Checklist";

const EMPTY_ROLES: never[] = [];

/**
 * Danh mục vai trò + kho cho ô gán. Mỗi danh mục chỉ tải khi có quyền đọc tương ứng
 * (`identity-roles:READ`, `warehouse-warehouses:READ`); thiếu quyền thì UI hiện mã / báo không chọn được.
 */
export function useReferenceData(selectedWarehouseIds: readonly string[] = []) {
  const canReadRoles = useCan(IDENTITY_PERMISSIONS.rolesRead);
  const canReadWarehouses = useCan(WAREHOUSE_PERMISSIONS.read);
  const rolesQuery = useRoleOptions(canReadRoles);
  const warehousesQuery = useWarehouseDirectory(canReadWarehouses);
  const roles = rolesQuery.data ?? EMPTY_ROLES;
  const warehouses = warehousesQuery.data;

  const roleItems: ChecklistItem[] = roles
    .filter((role) => isAssignableRole(role.code))
    .map((role) => ({
      value: role.code,
      label: role.name,
      hint: role.code === role.name ? undefined : role.code,
    }));
  // Kho đã ngừng hoạt động chỉ hiện khi đang được gán, để người quản trị gỡ được.
  const keep = new Set(selectedWarehouseIds);
  const warehouseItems: ChecklistItem[] = (warehouses ?? [])
    .filter((warehouse) => warehouse.active || keep.has(warehouse.warehouseId))
    .map((warehouse) => ({
      value: warehouse.warehouseId,
      label: warehouse.name,
      hint: warehouse.active ? warehouse.code : `${warehouse.code} · ngừng hoạt động`,
    }));

  return {
    canReadRoles,
    canReadWarehouses,
    roles,
    rolesLoading: canReadRoles && rolesQuery.isPending,
    rolesError: canReadRoles && rolesQuery.isError,
    warehouses: warehouses ?? [],
    warehousesLoading: canReadWarehouses && warehousesQuery.isPending,
    roleItems,
    warehouseItems,
  };
}
