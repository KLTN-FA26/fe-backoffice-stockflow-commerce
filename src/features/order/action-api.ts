/**
 * Order — API thao tác điều phối: credit hold (SCRUM-427) và lệnh sản xuất của đơn (đọc từ module
 * production của BE). Parse tại biên như `api.ts`. Release đơn (PR #74): `delivery-mode-api.ts`.
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";
import { idempotencyRequestConfig } from "@/lib/api/idempotency";

import { orderPath, ORDERS_PATH, toOrder, type OrderMutationVars } from "./api";
import { creditHoldPageDtoSchema, creditPositionDtoSchema } from "./credit-hold-schemas";
import { productionOrderPageDtoSchema } from "./production-schemas";
import { isValidOrderCustomerId, orderDtoSchema } from "./schemas";

import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  CreditApprovalInput,
  CreditHold,
  CreditPosition,
  CreditRejectionInput,
  Order,
  ProductionOrder,
  ProductionOrderDto,
} from "./types";

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
  input: OrderMutationVars<CreditApprovalInput>,
): Promise<Order> {
  const { id, note, idempotencyKey } = input;
  const { data } = await api.post<unknown>(
    orderPath(id, "/credit-approval"),
    { note },
    idempotencyRequestConfig(idempotencyKey),
  );
  return toOrder(orderDtoSchema.parse(data));
}

/**
 * `POST /orders/{id}/credit-rejection {action, depositPercent?, note}` — CANCEL huỷ đơn
 * (CREDIT_REJECTED); SWITCH_TO_* chuyển đơn về PENDING_PAYMENT.
 */
export async function rejectCreditHold(
  input: OrderMutationVars<CreditRejectionInput>,
): Promise<Order> {
  const { id, idempotencyKey, ...body } = input;
  const { data } = await api.post<unknown>(
    orderPath(id, "/credit-rejection"),
    body,
    idempotencyRequestConfig(idempotencyKey),
  );
  return toOrder(orderDtoSchema.parse(data));
}

/**
 * `GET /orders/credit-position/{customerId}` — BE CreditHoldController#position,
 * `customer-credit-profiles:READ`. `{customerId}` là UUID (BE trả 400 UNSUPPORTED_PARAMETER nếu
 * không phải) — chặn ở đây, không bao giờ gọi với id khác.
 */
export async function getCreditPosition(
  customerId: string,
  signal?: AbortSignal,
): Promise<CreditPosition> {
  if (!isValidOrderCustomerId(customerId)) {
    throw new Error(`customerId phải là UUID: ${customerId}`);
  }
  const { data } = await api.get<unknown>(
    `${ORDERS_PATH}/credit-position/${encodeURIComponent(customerId)}`,
    { signal },
  );
  const dto = creditPositionDtoSchema.parse(data);
  return {
    customerId: dto.customerId,
    allowedTerms: dto.allowedTerms,
    defaultTerm: dto.defaultTerm,
    depositPercent: dto.depositPercent ?? null,
    creditLimit: dto.creditLimit ?? null,
    creditTermDays: dto.creditTermDays ?? null,
    exposure: dto.exposure,
    availableCredit: dto.availableCredit ?? null,
    currency: dto.currency,
    hasOverdue: dto.hasOverdue,
  };
}

/* ── Lệnh sản xuất của đơn ──────────────────────────────────────────── */

export const PRODUCTION_ORDERS_PATH = "/production/orders";
/** BE `Pages.MAX_PAGE_SIZE` — vượt thì 400 UNSUPPORTED_PARAMETER (không tự kẹp). */
const PRODUCTION_PAGE_SIZE = 200;
/** Chặn vòng lặp nếu BE trả `hasNext` sai — 200 × 10 LSX cho một đơn đã quá thực tế. */
const PRODUCTION_MAX_PAGES = 10;

/**
 * `GET /production/orders?salesOrderId=…&type=ORDER` — BE ProductionOrderController#list,
 * `production-orders:READ` (ACCOUNTANT không có → 403). Đọc hết các trang (cũ nhất trước để LSX gốc
 * đứng trước LSX con). Bỏ dòng không gắn dòng đơn (LSX mẫu) — không nhóm được theo dòng.
 */
export async function listOrderProductionOrders(
  salesOrderId: string,
  signal?: AbortSignal,
): Promise<ProductionOrder[]> {
  const rows: ProductionOrderDto[] = [];
  for (let page = 0; page < PRODUCTION_MAX_PAGES; page++) {
    const params = new URLSearchParams({
      salesOrderId,
      type: "ORDER",
      sort: "createdAt,asc",
      page: String(page),
      size: String(PRODUCTION_PAGE_SIZE),
    });
    const { data } = await api.get<unknown>(PRODUCTION_ORDERS_PATH, { params, signal });
    const parsed = productionOrderPageDtoSchema.parse(data);
    rows.push(...parsed.items);
    if (!parsed.hasNext) break;
  }
  return rows.flatMap((po) =>
    po.salesOrderLineId
      ? [
          {
            productionOrderId: po.id,
            productionOrderNumber: po.orderNumber,
            salesOrderLineId: po.salesOrderLineId,
            parentId: po.parentId ?? null,
            mode: po.mode,
            status: po.status,
            holdReason: po.holdReason ?? null,
            plannedQuantity: po.plannedQuantity,
            goodQuantity: po.goodQuantity,
            dueDate: po.dueDate ?? null,
          },
        ]
      : [],
  );
}
