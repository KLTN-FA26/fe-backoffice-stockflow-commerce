"use client";

import { WAREHOUSE_LOCATION_LABELS as L } from "@/constants";

import { Alert } from "@/components/shared/Alert";

import type { LocationListData, StockAccess } from "./useLocationListData";

/**
 * Vì sao cột hàng trong vị trí trống hoặc chưa đủ: thiếu quyền tồn, không được gán kho, lỗi tải, hay tồn bị cắt ở
 * trần đọc (data-table-mode-a §4.1 — danh sách cắt phải có cảnh báo; "Trống" khi đó có thể sai nên bộ lọc bị tắt).
 */
export function LocationStockNotice({
  access,
  data,
}: {
  access: { access: StockAccess; pending: boolean };
  data: LocationListData;
}) {
  if (access.pending) return null;
  if (access.access === "no-permission") return <Alert tone="info">{L.stockNoPermission}</Alert>;
  if (access.access === "not-assigned") return <Alert tone="info">{L.stockNotAssigned}</Alert>;
  if (data.stock.isError) return <Alert tone="warning">{L.stockError}</Alert>;
  if (data.truncated)
    return <Alert tone="warning">{L.stockTruncated(data.stockRowCount, data.stockTotal)}</Alert>;
  return null;
}
