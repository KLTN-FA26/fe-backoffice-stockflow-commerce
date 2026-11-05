/**
 * Tra cứu cho phiếu nhận không có PO (BR-RCP-002, SCRUM-478): nhà cung cấp, kho nhận và đơn đặt hàng của một NCC (để
 * gắn tham chiếu). Receipt KHÔNG import `features/supplier` / `features/purchase-order` (import boundary) — parse bằng
 * schema nhỏ của receipt, như `receivable-po-api.ts`.
 *
 * Quyền: `procurement-suppliers:READ`, `warehouse-warehouses:READ`, `procurement-purchase-orders:READ`. Seed BE
 * không cấp quyền xem NCC cho WAREHOUSE_STAFF (chỉ WAREHOUSE_MANAGER / PROCUREMENT_STAFF) nên NV kho không tự chọn
 * được NCC ở màn này cho tới khi admin cấp thêm — giống khoảng trống quyền đọc PO của màn tạo phiếu theo PO.
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import {
  receivablePoPageSchema,
  supplierOptionPageSchema,
  warehouseOptionPageSchema,
} from "./schemas";

import type { PaginatedResponse } from "@/lib/api/query-factory";
import type { ReceivablePo, SupplierOption, WarehouseOption } from "./types";

export async function listSupplierOptions(signal?: AbortSignal): Promise<SupplierOption[]> {
  const { data } = await api.get<unknown>("/suppliers", {
    params: { page: 0, size: PAGE_SIZE.masterData, sort: "name,asc" },
    signal,
  });
  return supplierOptionPageSchema.parse(data).items;
}

export async function listWarehouseOptions(signal?: AbortSignal): Promise<WarehouseOption[]> {
  const { data } = await api.get<unknown>("/warehouses", {
    params: { page: 0, size: PAGE_SIZE.masterData, status: "ACTIVE" },
    signal,
  });
  return warehouseOptionPageSchema.parse(data).items;
}

/** Đơn đặt hàng của một NCC, mọi trạng thái — để gắn tham chiếu cho phiếu không có PO. */
export async function listSupplierPurchaseOrders(
  supplierId: string,
  signal?: AbortSignal,
): Promise<PaginatedResponse<ReceivablePo>> {
  const { data } = await api.get<unknown>("/purchase-orders", {
    params: { page: 0, size: PAGE_SIZE.masterData, supplierId, sort: "createdAt,desc" },
    signal,
  });
  return receivablePoPageSchema.parse(data);
}
