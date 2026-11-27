import { WAREHOUSE_PERMISSIONS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";

/**
 * Kho xuất đã chọn khi release (SCRUM-423). Tên kho tra qua danh mục `GET /warehouses` (mọi trạng
 * thái — kho có thể đã ngừng hoạt động sau khi release), chỉ khi có `warehouse-warehouses:READ`:
 * thiếu quyền (vd ORDER_COORDINATOR trước BE V20261022000100) thì không gọi API, báo không xem được tên.
 * UI-only — Backend phải re-check (WarehouseController @RequiresPermission warehouse-warehouses:READ).
 * Không tìm thấy tên (đang tải, hoặc kho không còn trong danh mục) → nhãn trung tính, không hiện UUID kho (BO-UX-6).
 */
export function OrderWarehouseName({ warehouseId }: { warehouseId: string }) {
  const can = usePermissionChecker();
  const canRead = can(WAREHOUSE_PERMISSIONS.read);
  const { data } = useWarehouseDirectory(canRead);
  const warehouse = data?.find((w) => w.warehouseId === warehouseId);
  if (warehouse) return <span>{warehouse.name}</span>;
  return (
    <span className="text-ink-secondary">
      {canRead ? "Đã chọn kho xuất" : "Đã chọn kho — tài khoản chưa có quyền xem tên kho"}
    </span>
  );
}
