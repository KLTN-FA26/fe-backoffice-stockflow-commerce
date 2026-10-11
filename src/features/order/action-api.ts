/**
 * Order — API thao tác điều phối: release (SCRUM-423), credit hold (SCRUM-427) và lệnh sản xuất
 * của đơn (hợp đồng đã thống nhất, BE chưa có endpoint). Parse tại biên như `api.ts`.
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import { orderPath, ORDERS_PATH, toOrder } from "./api";
import { creditHoldPageDtoSchema } from "./credit-hold-schemas";
import { productionOrderListDtoSchema } from "./production-schemas";
import { orderDtoSchema } from "./schemas";

import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  CreditApprovalInput,
  CreditHold,
  CreditRejectionInput,
  Order,
  ProductionOrder,
  ReleaseOrderInput,
} from "./types";

/* ── Release ─────────────────────────────────────────────────────────── */

/**
 * `POST /orders/{id}/release {warehouseId}` — BE OrderReleaseController, `sales-orders:APPROVE`.
 * Thành công: có dòng in → IN_PRODUCTION (sinh lệnh sản xuất), chỉ hàng sẵn → READY_TO_FULFILL.
 * Từ chối (409/404) mang `errorCode` — map ở `errors.ts#releaseErrorView`.
 */
export async function releaseOrder(input: ReleaseOrderInput & { id: string }): Promise<Order> {
  const { id, warehouseId } = input;
  const { data } = await api.post<unknown>(orderPath(id, "/release"), { warehouseId });
  return toOrder(orderDtoSchema.parse(data));
}

/* ── Credit hold ─────────────────────────────────────────────────────── */

export interface ListCreditHoldParams extends ListQueryParams {
  /** Trang đánh số từ 0. BE không có lọc / sort — cũ nhất trước. */
  page?: number;
  size?: number;
}

export async function listCreditHolds(
  params: ListCreditHoldParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<CreditHold>> {
  const { page = 0, size = PAGE_SIZE.md } = params;
  const query = new URLSearchParams({ page: String(Math.max(0, page)), size: String(size) });
  const { data } = await api.get<unknown>(`${ORDERS_PATH}/credit-holds`, { params: query, signal });
  const parsed = creditHoldPageDtoSchema.parse(data);
  return {
    ...parsed,
    items: parsed.items.map((hold) => ({ ...hold, order: toOrder(hold.order) })),
  };
}

/** `POST /orders/{id}/credit-approval {note}` → đơn CONFIRMED. */
export async function approveCreditHold(
  input: CreditApprovalInput & { id: string },
): Promise<Order> {
  const { id, note } = input;
  const { data } = await api.post<unknown>(orderPath(id, "/credit-approval"), { note });
  return toOrder(orderDtoSchema.parse(data));
}

/**
 * `POST /orders/{id}/credit-rejection {action, depositPercent?, note}` — CANCEL huỷ đơn
 * (CREDIT_REJECTED); SWITCH_TO_* chuyển đơn về PENDING_PAYMENT.
 */
export async function rejectCreditHold(
  input: CreditRejectionInput & { id: string },
): Promise<Order> {
  const { id, ...body } = input;
  const { data } = await api.post<unknown>(orderPath(id, "/credit-rejection"), body);
  return toOrder(orderDtoSchema.parse(data));
}

/* ── Lệnh sản xuất (CONTRACT PENDING) ───────────────────────────────── */

/**
 * `GET /orders/{id}/production-orders` — hợp đồng đã thống nhất (xem `production-schemas.ts`);
 * BE develop chưa có. 404/405 từ BE thật → `isProductionApiUnavailable` để UI báo đúng.
 */
export async function listOrderProductionOrders(
  id: string,
  signal?: AbortSignal,
): Promise<ProductionOrder[]> {
  const { data } = await api.get<unknown>(orderPath(id, "/production-orders"), { signal });
  return productionOrderListDtoSchema.parse(data).map((po) => ({
    ...po,
    parentId: po.parentId ?? null,
    statusBeforeHold: po.statusBeforeHold ?? null,
    holdReason: po.holdReason ?? null,
    dueDate: po.dueDate ?? null,
    subcontractorName: po.subcontractorName ?? null,
  }));
}
