import { WAREHOUSE_PERMISSIONS } from "@/constants";
import { useAssignedWarehouses, useCan } from "@/lib/auth";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";

import type { HeaderFilterOption } from "@/components/shared/ColumnHeaderFilter";

/**
 * Kho lọc được trên màn Thùng hàng. Người xem bị giới hạn theo kho (`DataScope.WAREHOUSE`) chỉ thấy kho được gán — lọc
 * kho khác BE trả 403 OUT_OF_DATA_SCOPE. Không đọc được danh mục kho → dùng mã kho được gán làm nhãn.
 */
export function useCartonWarehouses(): HeaderFilterOption[] {
  const canReadWarehouses = useCan(WAREHOUSE_PERMISSIONS.read);
  const directory = useWarehouseDirectory(canReadWarehouses);
  const assigned = useAssignedWarehouses();
  const restricted = assigned.scope === "restricted";
  const assignedIds = new Set(assigned.warehouses.map((warehouse) => warehouse.id));
  const fromDirectory = (directory.data ?? [])
    .filter((warehouse) => !restricted || assignedIds.has(warehouse.warehouseId))
    .map((warehouse) => ({
      value: warehouse.warehouseId,
      label: warehouse.name ? `${warehouse.code} · ${warehouse.name}` : warehouse.code,
    }));
  if (fromDirectory.length > 0 || !restricted) return fromDirectory;
  return assigned.warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.prefix }));
}
