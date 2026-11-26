/**
 * Đơn sản xuất cho màn phiếu nhập (docs 03 §4.1, SCRUM-566) — chọn đơn nhận được hàng và lấy dòng cần đếm. Đặt ở
 * `lib/` để feature `receipt` không import `features/production-order` (feature-architecture). Key dưới root
 * `production-orders` của feature đó nên lập / xác nhận phiếu làm mới cả hai. BE `GET /production-orders`,
 * `GET /production-orders/{id}` (production-orders:READ).
 */

import { useQueries, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import {
  PAGE_SIZE,
  PRODUCTION_ORDER_STATUSES,
  RECEIVABLE_PRODUCTION_ORDER_STATUSES,
  SAMPLE_GATED_PRODUCTION_ORDER_STATUSES,
  SHARED_QUERY_ROOTS,
} from "@/constants";
import { api } from "@/lib/api/client";
import { QUERY_TIMES } from "@/lib/api/query-client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ProductionOrderStatus } from "@/constants";

/** Dòng Đơn sản xuất (BE `ProductionOrderResponse.Line`) — chỉ phần phiếu nhập cần: số thùng đặt / đã nhận. */
const productionLineRefSchema = z.object({
  id: z.string(),
  sku: z.string(),
  cartons: z.number().int(),
  unitsPerCarton: z.number().int(),
  receivedCartons: z.number().int(),
});

const productionOrderRefSchema = z.object({
  id: z.string(),
  code: z.string(),
  status: z.enum(PRODUCTION_ORDER_STATUSES),
  receivingWarehouseId: z.string(),
  sampleApprovalRequired: z.boolean(),
  needByDate: z.string().nullish(),
  /** Ngày đơn vị sản xuất báo xong (ngày giao dự kiến) — ghi khi nhận đơn. */
  expectedCompletionDate: z.string().nullish(),
  /** Tên đơn vị sản xuất do BE kèm sẵn (FE#286) — dòng danh sách nêu tên, không cần quyền đọc danh mục đơn vị. */
  producerName: z.string().nullish(),
  lines: z.array(productionLineRefSchema).default([]),
});
const productionOrderRefPageSchema = z.object({ items: z.array(productionOrderRefSchema) });

export type ProductionOrderRef = z.infer<typeof productionOrderRefSchema>;
export type ProductionLineRef = z.infer<typeof productionLineRefSchema>;

export const productionOrderRefKeys = {
  receivable: (status: ProductionOrderStatus) =>
    [SHARED_QUERY_ROOTS.productionOrders, "receivable", status] as const,
  detail: (id: string) => [SHARED_QUERY_ROOTS.productionOrders, "receipt-lines", id] as const,
};

const SAMPLE_GATED: readonly ProductionOrderStatus[] = SAMPLE_GATED_PRODUCTION_ORDER_STATUSES;

/**
 * BR-01 / BR-15 (docs 03 §6): Đơn sản xuất nhận được hàng — `In Production` / `Partially Received`; `Sent` /
 * `Accepted` chỉ khi không bật cờ duyệt mẫu in. UI-only — Backend phải re-check (`PRODUCTION_ORDER_NOT_RECEIVABLE`).
 */
export function isReceivableProductionOrder(
  order: Pick<ProductionOrderRef, "status" | "sampleApprovalRequired">,
): boolean {
  const statuses: readonly ProductionOrderStatus[] = RECEIVABLE_PRODUCTION_ORDER_STATUSES;
  if (!statuses.includes(order.status)) return false;
  return !(SAMPLE_GATED.includes(order.status) && order.sampleApprovalRequired);
}

/** Thùng còn mở của cả đơn = Σ (đặt − đã nhận) — BE chỉ tính phiếu đã xác nhận vào `receivedCartons`. */
export function openCartonsOf(order: Pick<ProductionOrderRef, "lines">): number {
  return order.lines.reduce(
    (sum, line) => sum + Math.max(0, line.cartons - line.receivedCartons),
    0,
  );
}

export function orderedCartonsOf(order: Pick<ProductionOrderRef, "lines">): number {
  return order.lines.reduce((sum, line) => sum + line.cartons, 0);
}

async function fetchByStatus(
  status: ProductionOrderStatus,
  signal?: AbortSignal,
): Promise<ProductionOrderRef[]> {
  const { data } = await api.get<unknown>("/production-orders", {
    params: { status, page: 0, size: PAGE_SIZE.masterData, sort: "needByDate,asc" },
    signal,
  });
  return productionOrderRefPageSchema.parse(data).items;
}

/** SKU của đơn, mỗi mã một lần, theo thứ tự dòng — dòng danh sách chọn Đơn sản xuất nêu hàng đang nhận. */
export function skusOf(order: Pick<ProductionOrderRef, "lines">): string[] {
  return [...new Set(order.lines.map((line) => line.sku))];
}

/** Hạn cần sớm nhất lên đầu; đơn chưa có hạn xếp cuối (không chen trước đơn gấp). */
function byNeedByDate(a: ProductionOrderRef, b: ProductionOrderRef): number {
  if (!a.needByDate || !b.needByDate) return Number(!a.needByDate) - Number(!b.needByDate);
  return a.needByDate.localeCompare(b.needByDate);
}

/** Ổn định tham chiếu (module-level) để TanStack memo kết quả gộp, không gộp + sắp lại mỗi lần render. */
function combineReceivable(results: UseQueryResult<ProductionOrderRef[]>[]) {
  return {
    data: results
      .flatMap((result) => result.data ?? [])
      .filter(isReceivableProductionOrder)
      // Chỉ đơn còn thùng chưa nhập — đơn đã nhập đủ không còn gì để lập phiếu
      .filter((order) => openCartonsOf(order) > 0)
      .sort(byNeedByDate),
    isPending: results.some((result) => result.isPending),
    isError: results.some((result) => result.isError),
    refetch: () => results.forEach((result) => void result.refetch()),
  };
}

/**
 * Đơn sản xuất nhận được hàng ở kho người dùng được gán (BE lọc theo kho với người dùng gắn kho). BE chỉ lọc một
 * `status` mỗi lần → gọi song song từng trạng thái nhận được rồi gộp, bỏ đơn chờ duyệt mẫu in (BR-15).
 */
export function useReceivableProductionOrders(enabled = true) {
  return useQueries({
    queries: RECEIVABLE_PRODUCTION_ORDER_STATUSES.map((status) => ({
      queryKey: productionOrderRefKeys.receivable(status),
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchByStatus(status, signal),
      enabled,
      ...QUERY_TIMES.list,
    })),
    combine: combineReceivable,
  });
}

export async function fetchProductionOrderRef(
  id: string,
  signal?: AbortSignal,
): Promise<ProductionOrderRef> {
  const { data } = await api.get<unknown>(`/production-orders/${encodeURIComponent(id)}`, {
    signal,
  });
  return productionOrderRefSchema.parse(data);
}

/** Một Đơn sản xuất kèm dòng — phiếu nháp chưa có dòng nào nên màn kiểm đếm lấy dòng từ đây. */
export function useProductionOrderRef(id: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: productionOrderRefKeys.detail(id ?? ""),
    queryFn: ({ signal }) => fetchProductionOrderRef(id ?? "", signal),
    enabled: enabled && !!id,
    ...QUERY_TIMES.detail,
  });
}
