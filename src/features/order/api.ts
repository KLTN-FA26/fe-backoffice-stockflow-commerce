/**
 * Order — API layer, khớp BE `OrderController` (develop).
 *
 * Base URL của env đã gồm `/api/v1` → path không ghi `v1`. Envelope `{success, data}`
 * đã được interceptor ở `lib/api/client.ts` bóc. Parse tại biên (api-conventions §3.2):
 * zod validate một lần ở đây rồi map DTO BE → model FE; component chỉ thấy `Order`.
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import { orderDtoSchema, orderPageDtoSchema } from "./schemas";
import { mapBackendOrderStatus, toBackendOrderStatuses } from "./status-map";

import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type { Order, OrderDto, OrderStatus } from "./types";
import type {
  DeliveryFailureValues,
  HoldOrderValues,
  RemainderClosureValues,
  ResolveOrderHoldValues,
} from "./schemas";

const ORDERS_PATH = "/orders";

function joinParts(parts: readonly (string | null | undefined)[]): string {
  return parts.filter((part): part is string => !!part?.trim()).join(", ");
}

/** DTO BE → model FE. Pure — export để test. */
export function toOrder(dto: OrderDto): Order {
  const address = dto.shippingAddress ?? null;
  const addressText = address
    ? joinParts([address.line1, address.line2, address.wardName, address.provinceName])
    : "";
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
      shippedQuantity: line.shippedQuantity ?? null,
      deliveredQuantity: line.deliveredQuantity ?? null,
      cancelledQuantity: line.cancelledQuantity ?? null,
    })),
    paymentTerm: dto.paymentTerm ?? null,
    holdReason: dto.holdReason ?? null,
    holdReasonPublic: dto.holdReasonPublic ?? null,
    statusBeforeHold: dto.statusBeforeHold ? mapBackendOrderStatus(dto.statusBeforeHold) : null,
    holdNote: dto.holdNote ?? null,
    packedAt: dto.packedAt ?? null,
    shippedAt: dto.shippedAt ?? null,
    deliveredAt: dto.deliveredAt ?? null,
    deliveryFailureReason: dto.deliveryFailureReason ?? null,
    completedAt: dto.completedAt ?? null,
    closedAt: dto.closedAt ?? null,
    billedAmount: dto.billedAmount ?? null,
    effectiveTotal: dto.effectiveTotal ?? null,
    amountDue: dto.amountDue ?? null,
    amountDueBeforeHandover: dto.amountDueBeforeHandover ?? null,
    shipments: (dto.shipments ?? []).map((shipment) => ({
      shipmentId: shipment.shipmentId,
      status: shipment.status,
      amount: shipment.amount ?? null,
      billedAmount: shipment.billedAmount ?? null,
      handedOverAt: shipment.handedOverAt ?? null,
      outcomeAt: shipment.outcomeAt ?? null,
      failureReason: shipment.failureReason ?? null,
      lines: shipment.lines ?? [],
    })),
    balancePolicy: dto.balancePolicy ?? null,
    creditTermDays: dto.creditTermDays ?? null,
    allowPartialShipment: dto.allowPartialShipment ?? null,
    printLinesReady: dto.printLinesReady ?? null,
  };
}

/* ── List ────────────────────────────────────────────────────────────── */
// ASSUMPTION (open-question Tú): BE chưa có `GET /orders` cho admin (405 khi gọi thật) —
// chạy trên mock. `page`/`size` theo BE PageResponse (như `/orders/me`); `search`/`status`/
// `sort` đặt tên theo quy ước NCC, xác nhận lại khi BE bổ sung endpoint.

export interface ListOrderParams extends ListQueryParams {
  /** Trang đánh số từ 0 (BE PageResponse). */
  page?: number;
  size?: number;
  search?: string;
  status?: OrderStatus[];
  /** `field,asc|desc`. */
  sort?: string;
}

export async function listOrders(
  params: ListOrderParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Order>> {
  const { page = 0, size = PAGE_SIZE.md, search, status, sort } = params;
  const backendStatuses = toBackendOrderStatuses(status ?? []);

  // Tự dựng query như NCC: chỉ gửi param có giá trị (không `search=` rỗng), mảng status
  // phát key lặp `status=A&status=B` — serializer mặc định của axios sẽ ra `status[]=`.
  const query = new URLSearchParams({ page: String(Math.max(0, page)), size: String(size) });
  if (search?.trim()) query.set("search", search.trim());
  for (const value of backendStatuses) query.append("status", value);
  if (sort?.trim()) query.set("sort", sort.trim());

  const { data } = await api.get<unknown>(ORDERS_PATH, { params: query, signal });
  const parsed = orderPageDtoSchema.parse(data);
  return { ...parsed, items: parsed.items.map(toOrder) };
}

/* ── Detail ──────────────────────────────────────────────────────────── */

export async function getOrder(id: string, signal?: AbortSignal): Promise<Order> {
  const { data } = await api.get<unknown>(`${ORDERS_PATH}/${encodeURIComponent(id)}`, { signal });
  return toOrder(orderDtoSchema.parse(data));
}

/* ── Admin cancel ────────────────────────────────────────────────────── */
// POST /orders/{orderId}/admin-cancellation — BE `orders:APPROVE` scope ALL, body JSON
// {reason} bắt buộc (@NotBlank). Flow riêng, KHÔNG chung với self-cancel của khách
// (POST .../cancellation, scope OWN) — hai flow khác quyền, không share logic.

export interface AdminCancelOrderInput {
  id: string;
  reason: string;
}

export async function adminCancelOrder(input: AdminCancelOrderInput): Promise<void> {
  const { id, reason } = input;
  await api.post(`${ORDERS_PATH}/${encodeURIComponent(id)}/admin-cancellation`, { reason });
}

/* ── Hold / resolve / delivery-failure / remainder-closure ───────────── */
// BE PR #133. Body bỏ `note` khi trống (BE `@Size`, null hợp lệ trừ OTHER / gỡ giữ).
// - POST /orders/{id}/hold              {reasonCode, note?}   — sales-orders:APPROVE
// - POST /orders/{id}/hold/resolution   {note}                — sales-orders:APPROVE
// - POST /orders/{id}/delivery-failure  {reasonCode, note?}   — sales-orders:APPROVE
// - POST /orders/{id}/remainder-closure {reasonCode, note?, agreedFee?{amount, reason, detail}}
//                                                             — sales-order-cancellations:UPDATE

export type HoldOrderInput = { id: string } & HoldOrderValues;
export type ResolveOrderHoldInput = { id: string } & ResolveOrderHoldValues;
export type DeliveryFailureInput = { id: string } & DeliveryFailureValues;
export type RemainderClosureInput = { id: string } & RemainderClosureValues;

function reasonBody({ reasonCode, note }: { reasonCode: string; note: string }) {
  return note ? { reasonCode, note } : { reasonCode };
}

export async function holdOrder(input: HoldOrderInput): Promise<void> {
  await api.post(`${ORDERS_PATH}/${encodeURIComponent(input.id)}/hold`, reasonBody(input));
}

export async function resolveOrderHold(input: ResolveOrderHoldInput): Promise<void> {
  await api.post(`${ORDERS_PATH}/${encodeURIComponent(input.id)}/hold/resolution`, {
    note: input.note,
  });
}

export async function recordDeliveryFailure(input: DeliveryFailureInput): Promise<void> {
  await api.post(
    `${ORDERS_PATH}/${encodeURIComponent(input.id)}/delivery-failure`,
    reasonBody(input),
  );
}

/**
 * `agreedFee` (BE PR #150) chỉ gửi khi có: số tiền khách thoả thuận cho phần hàng in đã in. BE trả `Order`
 * — không mang số hoàn / giữ / còn nợ của lần đóng này (chúng nằm trong sự kiện `OrderRemainderClosed`),
 * chỉ `amountDue` / `effectiveTotal` mới, nên màn chi tiết tải lại đơn thay vì đọc phản hồi.
 */
export async function closeOrderRemainder(input: RemainderClosureInput): Promise<void> {
  await api.post(`${ORDERS_PATH}/${encodeURIComponent(input.id)}/remainder-closure`, {
    ...reasonBody(input),
    ...(input.agreedFee ? { agreedFee: input.agreedFee } : {}),
  });
}
