/**
 * PO để nhận hàng — đọc qua API PO hiện có `GET /purchase-orders` (người dùng chốt 2026-10-09).
 *
 * Receipt BE (PR #62) kiểm `purchaseOrderId` / `purchaseOrderLineId` trên bảng PO mới; API PO hiện
 * đọc bảng cũ. Theo C4 plan BE giữ URL, chỉ chuyển logic sang bảng mới — FE không phải đổi.
 * Trước C4, môi trường test cần PO trùng id (PO + dòng) ở hai bảng.
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
 * BR-01 (docs 03 §6): chỉ nhận cho PO đã chốt hoặc đang nhận dở.
 * Bảng PO cũ gọi "đã chốt" là SENT; BE PO chưa nhận CONFIRMED (enum cũ → 400).
 * Khi C4 đổi enum PO sang CONFIRMED thì chỉ sửa danh sách này.
 */
export const RECEIVABLE_PO_API_STATUSES = ["SENT", "PARTIALLY_RECEIVED"] as const;

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
