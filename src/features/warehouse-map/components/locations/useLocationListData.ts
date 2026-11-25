import { useMemo } from "react";

import { INVENTORY_PERMISSIONS } from "@/constants";
import { canEnterWarehouse, useAssignedWarehouses, useCan } from "@/lib/auth";

import {
  filterLocationRows,
  locationFilterOptions,
  pageOfRows,
} from "@/features/warehouse-map/location-list-filters";
import { buildLocationRows } from "@/features/warehouse-map/location-list-selectors";
import { useWarehouseLayout, useWarehouseStock } from "@/features/warehouse-map/queries";

import type { WorkspaceWarehouse } from "@/lib/workspace";
import type { LocationFiltersState } from "./useLocationFilters";

/** Vì sao cột hàng trong vị trí trống: thiếu quyền tồn / không được gán kho (BE `DataScope.WAREHOUSE` → 403). */
export type StockAccess = "ok" | "no-permission" | "not-assigned";

/**
 * Đọc được hàng trong vị trí của kho này không: cần `inventory-stock-items:READ` VÀ được gán kho (BE
 * `DataScope.WAREHOUSE` → 403 ở kho khác). `pending` khi danh sách kho được gán còn đang tải. UI-only, BE re-check.
 */
export function useStockAccess(prefix: string): { access: StockAccess; pending: boolean } {
  const canReadStock = useCan(INVENTORY_PERMISSIONS.stockRead);
  const assigned = useAssignedWarehouses();
  if (!canReadStock) return { access: "no-permission", pending: false };
  if (assigned.isLoading) return { access: "not-assigned", pending: true };
  return { access: canEnterWarehouse(assigned, prefix) ? "ok" : "not-assigned", pending: false };
}

/**
 * Dữ liệu màn Danh sách vị trí: layout (mọi kho xem được — bản đồ không giới hạn kho được gán, docs 06) ghép tồn theo
 * vị trí khi `access` là "ok".
 */
export function useLocationListData(
  warehouse: WorkspaceWarehouse,
  access: StockAccess,
  state: LocationFiltersState,
  pageSize: number,
) {
  const layout = useWarehouseLayout(warehouse.id);
  const stock = useWarehouseStock(warehouse, access === "ok");
  const stockData = access === "ok" ? stock.data : undefined;
  // Dựng lại chỉ khi dữ liệu đổi: tồn cả kho tới 2000 dòng — gõ tìm (đổi URL) không dựng lại
  const rows = useMemo(
    () => (layout.data ? buildLocationRows(layout.data, stockData?.rows ?? null) : []),
    [layout.data, stockData],
  );
  const filtered = filterLocationRows(rows, state.filters);
  return {
    layout,
    stock,
    truncated: stockData?.truncated ?? false,
    stockLoaded: stockData !== undefined,
    stockRowCount: stockData?.rows.length ?? 0,
    stockTotal: stockData?.total ?? 0,
    rows,
    options: locationFilterOptions(rows),
    page: pageOfRows(filtered, state.page, pageSize),
  };
}

export type LocationListData = ReturnType<typeof useLocationListData>;
