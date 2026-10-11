/**
 * Order — API layer, khớp BE `OrderController` (develop).
 *
 * Base URL của env đã gồm `/api/v1` → path không ghi `v1`. Envelope `{success, data}`
 * đã được interceptor ở `lib/api/client.ts` bóc. Parse tại biên (api-conventions §3.2):
 * zod validate một lần ở đây rồi map DTO BE → model FE; component chỉ thấy `Order`.
 * Release / credit hold / lệnh sản xuất: `action-api.ts`.
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import { orderDtoSchema, orderPageDtoSchema, orderStatusChangeDtoSchema } from "./schemas";
import { mapBackendOrderStatus, toBackendOrderStatuses } from "./status-map";

import type { OrderPaymentTerm } from "@/constants";
import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  AdminCancelOrderInput,
  Order,
  OrderDto,
  OrderStatus,
  OrderStatusChange,
} from "./types";

export const ORDERS_PATH = "/orders";

export function orderPath(id: string, suffix = ""): string {
  return `${ORDERS_PATH}/${encodeURIComponent(id)}${suffix}`;
}

function joinParts(parts: readonly (string | null | undefined)[]): string {
  return parts.filter((part): part is string => !!part?.trim()).join(", ");
}

/** DTO BE → model FE. Pure — export để test. */
export function toOrder(dto: OrderDto): Order {
  const address = dto.shippingAddress ?? null;
  const addressText = address
    ? joinParts([address.line1, address.line2, address.wardName, address.provinceName])
    : "";
  const cancellation = dto.cancellation ?? null;
  return {
    orderId: dto.orderId,
    orderNumber: dto.orderNumber,
    customerId: dto.customerId ?? null,
    status: mapBackendOrderStatus(dto.status),
    totalAmount: dto.totalAmount,
    currency: dto.currency,
    placedAt: dto.placedAt,
    recipientName: address?.recipientName ?? dto.contactName ?? "",
    recipientPhone: address?.phone ?? dto.contactPhone ?? "",
    contactEmail: dto.contactEmail ?? null,
    shippingAddressText: addressText || null,
    lines: dto.lines.map((line) => ({
      lineId: line.lineId,
      sku: line.sku,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
      // BE OrderLine#isMadeToOrder: dòng in ⇔ có design snapshot (docs 14 BR-02)
      isCustom: line.designSnapshotId != null,
      designSnapshotId: line.designSnapshotId ?? null,
      reservationIds: line.reservationIds,
    })),
    paymentTerm: dto.paymentTerm ?? null,
    paymentStatus: dto.paymentStatus ?? null,
    paidAmount: dto.paidAmount ?? null,
    depositRequired: dto.depositRequired ?? null,
    depositReceivedAt: dto.depositReceivedAt ?? null,
    paidInFullAt: dto.paidInFullAt ?? null,
    creditTermDays: dto.creditTermDays ?? null,
    warehouseId: dto.warehouseId ?? null,
    releasedAt: dto.releasedAt ?? null,
    cancellation: cancellation
      ? {
          reasonCode: cancellation.reasonCode ?? null,
          reason: cancellation.reason ?? null,
          retainedAmount: cancellation.retainedAmount ?? null,
        }
      : null,
  };
}

/* ── List ────────────────────────────────────────────────────────────── */

export interface ListOrderParams extends ListQueryParams {
  /** Trang đánh số từ 0 (BE PageResponse). */
  page?: number;
  size?: number;
  search?: string;
  status?: OrderStatus[];
  customerId?: string;
  /** `yyyy-MM-dd`, cả hai đầu tính, múi giờ Asia/Ho_Chi_Minh (BE OrderServiceImpl). */
  placedFrom?: string;
  placedTo?: string;
  /**
   * CONTRACT PENDING (B0 đã duyệt): BE `GET /orders` CHƯA có tham số `paymentTerm`. FE gửi theo
   * hợp đồng đã thống nhất; mock lọc theo, BE thật hiện bỏ qua → UI ghi rõ bộ lọc chờ BE.
   */
  paymentTerm?: OrderPaymentTerm;
  /** `field,asc|desc`. */
  sort?: string;
}

export function buildOrderListQuery(params: ListOrderParams): URLSearchParams {
  const { page = 0, size = PAGE_SIZE.md, search, status, sort } = params;
  // Chỉ gửi param có giá trị (không `search=` rỗng); mảng status phát key lặp
  // `status=A&status=B` — serializer mặc định của axios sẽ ra `status[]=`.
  const query = new URLSearchParams({ page: String(Math.max(0, page)), size: String(size) });
  if (search?.trim()) query.set("search", search.trim());
  for (const value of toBackendOrderStatuses(status ?? [])) query.append("status", value);
  if (params.customerId?.trim()) query.set("customerId", params.customerId.trim());
  if (params.placedFrom) query.set("placedFrom", params.placedFrom);
  if (params.placedTo) query.set("placedTo", params.placedTo);
  if (params.paymentTerm) query.set("paymentTerm", params.paymentTerm);
  if (sort?.trim()) query.set("sort", sort.trim());
  return query;
}

export async function listOrders(
  params: ListOrderParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Order>> {
  const { data } = await api.get<unknown>(ORDERS_PATH, {
    params: buildOrderListQuery(params),
    signal,
  });
  const parsed = orderPageDtoSchema.parse(data);
  return { ...parsed, items: parsed.items.map(toOrder) };
}

/* ── Detail ──────────────────────────────────────────────────────────── */

export async function getOrder(id: string, signal?: AbortSignal): Promise<Order> {
  const { data } = await api.get<unknown>(orderPath(id), { signal });
  return toOrder(orderDtoSchema.parse(data));
}

/** `GET /orders/{id}/history` — lịch sử trạng thái, cũ → mới (BE OrderStatusChangeResponse). */
export async function getOrderHistory(
  id: string,
  signal?: AbortSignal,
): Promise<OrderStatusChange[]> {
  const { data } = await api.get<unknown>(orderPath(id, "/history"), { signal });
  return orderStatusChangeDtoSchema
    .array()
    .parse(data)
    .map((change) => ({
      from: change.from ? mapBackendOrderStatus(change.from) : null,
      to: mapBackendOrderStatus(change.to),
      reason: change.reason ?? null,
      occurredAt: change.occurredAt,
    }));
}

/* ── Admin cancel ────────────────────────────────────────────────────── */
// POST /orders/{orderId}/admin-cancellation — BE `sales-order-cancellations:UPDATE` scope ALL.
// Flow riêng, KHÔNG chung với self-cancel của khách (POST .../cancellation, scope OWN).

export async function adminCancelOrder(
  input: AdminCancelOrderInput & { id: string },
): Promise<Order> {
  const { id, ...body } = input;
  const { data } = await api.post<unknown>(orderPath(id, "/admin-cancellation"), body);
  return toOrder(orderDtoSchema.parse(data));
}
