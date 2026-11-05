/**
 * PO để nhận hàng — đọc qua API PO hiện có `GET /purchase-orders` (người dùng chốt 2026-10-09).
 *
 * Receipt BE (PR #62) kiểm `purchaseOrderId` / `purchaseOrderLineId` trên `purchase_orders` /
 * `purchase_order_lines`; từ BE PR #71 API PO cũng đọc đúng các bảng đó (bảng cũ đã bỏ).
 * Không import `features/purchase-order` (import boundary) — parse bằng schema nhỏ của receipt.
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import { REPEAT_ARRAY_PARAMS } from "./api";
import { receivablePoPageSchema, receivablePoSchema } from "./schemas";

import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type { ReceivablePo } from "./types";

const PO_PATH = "/purchase-orders";

/**
 * BR-01 (docs 03 §6): chỉ nhận cho PO đã chốt (CONFIRMED, BE PR #71 D4 — trước đây SENT) hoặc
 * đang nhận dở. Gửi `status=SENT` cho BE mới là 400 (enum không còn giá trị đó).
 */
export const RECEIVABLE_PO_API_STATUSES = ["CONFIRMED", "PARTIALLY_RECEIVED"] as const;

export interface ListReceivablePoParams extends ListQueryParams {
  page?: number;
  size?: number;
}

export async function listReceivablePurchaseOrders(
  params: ListReceivablePoParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<ReceivablePo>> {
  const { data } = await api.get<unknown>(PO_PATH, {
    params: {
      page: Math.max(0, params.page ?? 0),
      size: params.size ?? PAGE_SIZE.xl,
      status: [...RECEIVABLE_PO_API_STATUSES],
      sort: "createdAt,desc",
    },
    paramsSerializer: REPEAT_ARRAY_PARAMS,
    signal,
  });
  return receivablePoPageSchema.parse(data);
}

/** Detail PO kèm dòng — `lineId` là `purchaseOrderLineId` của phiếu nhận. */
export async function getReceivablePurchaseOrder(
  id: string,
  signal?: AbortSignal,
): Promise<ReceivablePo> {
  const { data } = await api.get<unknown>(`${PO_PATH}/${encodeURIComponent(id)}`, { signal });
  return receivablePoSchema.parse(data);
}

/**
 * Số PO theo id cho cột "Đơn đặt hàng" — BE `GoodsReceiptRowResponse` chỉ có `purchaseOrderId`
 * (không có số PO). Một trang tối đa (Pages.MAX_PAGE_SIZE = 200), mọi trạng thái.
 */
export async function listPurchaseOrderNumbers(
  signal?: AbortSignal,
): Promise<Readonly<Record<string, string>>> {
  const { data } = await api.get<unknown>(PO_PATH, {
    params: { page: 0, size: PAGE_SIZE.masterData, sort: "createdAt,desc" },
    signal,
  });
  const page = receivablePoPageSchema.parse(data);
  return Object.fromEntries(page.items.map((po) => [po.purchaseOrderId, po.poNumber]));
}

export function isReceivablePoStatus(status: string): boolean {
  return (RECEIVABLE_PO_API_STATUSES as readonly string[]).includes(status);
}
