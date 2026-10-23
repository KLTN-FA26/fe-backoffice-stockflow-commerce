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
import { idempotencyRequestConfig } from "@/lib/api/idempotency";

import {
  isValidOrderCustomerId,
  orderDtoSchema,
  orderPageDtoSchema,
  orderStatusChangeDtoSchema,
} from "./schemas";
import { mapBackendOrderStatus, toBackendOrderStatuses } from "./status-map";

import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  AdminCancelOrderInput,
  DeliveryFailureValues,
  HoldOrderValues,
  Order,
  OrderDto,
  OrderStatus,
  OrderStatusChange,
  RemainderClosureValues,
  ResolveOrderHoldValues,
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
      shippedQuantity: line.shippedQuantity ?? null,
      deliveredQuantity: line.deliveredQuantity ?? null,
      cancelledQuantity: line.cancelledQuantity ?? null,
    })),
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
    amountDueOnDelivery: dto.amountDueOnDelivery ?? null,
    shipments: (dto.shipments ?? []).map((shipment) => ({
      shipmentId: shipment.shipmentId,
      status: shipment.status,
      amount: shipment.amount ?? null,
      billedAmount: shipment.billedAmount ?? null,
      handedOverAt: shipment.handedOverAt ?? null,
      outcomeAt: shipment.outcomeAt ?? null,
      failureReason: shipment.failureReason ?? null,
      lines: shipment.lines ?? [],
      codAmount: shipment.codAmount ?? null,
    })),
    paymentTerm: dto.paymentTerm ?? null,
    paymentStatus: dto.paymentStatus ?? null,
    paidAmount: dto.paidAmount ?? null,
    depositRequired: dto.depositRequired ?? null,
    depositReceivedAt: dto.depositReceivedAt ?? null,
    paidInFullAt: dto.paidInFullAt ?? null,
    creditTermDays: dto.creditTermDays ?? null,
    balancePolicy: dto.balancePolicy ?? null,
    warehouseId: dto.warehouseId ?? null,
    releasedAt: dto.releasedAt ?? null,
    cancellation: cancellation
      ? {
          reasonCode: cancellation.reasonCode ?? null,
          reason: cancellation.reason ?? null,
          retainedAmount: cancellation.retainedAmount ?? null,
          feeReason: cancellation.feeReason ?? null,
          feeDetail: cancellation.feeDetail ?? null,
          feeAmount: cancellation.feeAmount ?? null,
        }
      : null,
  };
}

/* ── List ────────────────────────────────────────────────────────────── */

/**
 * Đúng các tham số BE `OrderController#list` nhận: page, size, search, status (lặp), customerId
 * (UUID), placedFrom, placedTo, sort. KHÔNG có `paymentTerm` — BE chưa hỗ trợ lọc theo phương
 * thức thanh toán (field vẫn có trên `OrderResponse`, chỉ không lọc được).
 */
export interface ListOrderParams extends ListQueryParams {
  /** Trang đánh số từ 0 (BE PageResponse). */
  page?: number;
  size?: number;
  search?: string;
  status?: OrderStatus[];
  /** UUID khách — giá trị không phải UUID bị bỏ, không gửi (BE trả 400 cả trang). */
  customerId?: string;
  /** `yyyy-MM-dd`, cả hai đầu tính, múi giờ Asia/Ho_Chi_Minh (BE OrderServiceImpl). */
  placedFrom?: string;
  placedTo?: string;
  /** `field,asc|desc`. */
  sort?: string;
}

/**
 * Dựng query theo danh sách trắng ở trên — tham số lạ lọt vào lúc chạy (state cũ, link cũ có
 * `paymentTerm`) không bao giờ được gửi.
 */
export function buildOrderListQuery(params: ListOrderParams): URLSearchParams {
  const { page = 0, size = PAGE_SIZE.md, search, status, sort } = params;
  // Chỉ gửi param có giá trị (không `search=` rỗng); mảng status phát key lặp
  // `status=A&status=B` — serializer mặc định của axios sẽ ra `status[]=`.
  const query = new URLSearchParams({ page: String(Math.max(0, page)), size: String(size) });
  if (search?.trim()) query.set("search", search.trim());
  for (const value of toBackendOrderStatuses(status ?? [])) query.append("status", value);
  const customerId = params.customerId?.trim();
  if (customerId && isValidOrderCustomerId(customerId)) query.set("customerId", customerId);
  if (params.placedFrom) query.set("placedFrom", params.placedFrom);
  if (params.placedTo) query.set("placedTo", params.placedTo);
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
      actorId: change.actorId ?? null,
      actorName: change.actorName ?? null,
    }));
}

/* ── Admin cancel ────────────────────────────────────────────────────── */
// POST /orders/{orderId}/admin-cancellation — BE `sales-order-cancellations:UPDATE` scope ALL.
// Flow riêng, KHÔNG chung với self-cancel của khách (POST .../cancellation, scope OWN).

/** Biến của thao tác ghi đơn: id + input + `Idempotency-Key` (header, không vào body). */
export type OrderMutationVars<T> = T & { id: string; idempotencyKey?: string };

/** POST một thao tác ghi đơn: key chỉ ở header, response là `OrderResponse` → model FE. */
async function postOrderAction(
  id: string,
  suffix: string,
  body: object,
  idempotencyKey: string | undefined,
): Promise<Order> {
  const { data } = await api.post<unknown>(
    orderPath(id, suffix),
    body,
    idempotencyRequestConfig(idempotencyKey),
  );
  return toOrder(orderDtoSchema.parse(data));
}

/**
 * Body đúng `AdminCancelOrderRequest` (reasonCode, note?, retainedPercent?, agreedFee?) — `id` và
 * `idempotencyKey` không vào body; trả `OrderResponse` đã huỷ.
 */
export function adminCancelOrder(input: OrderMutationVars<AdminCancelOrderInput>): Promise<Order> {
  const { id, idempotencyKey, ...body } = input;
  return postOrderAction(id, "/admin-cancellation", body, idempotencyKey);
}

/* ── Hold / resolve / delivery-failure / remainder-closure ───────────── */
// BE PR #133 — `OrderReleaseController` / `OrderController`, mỗi endpoint trả `OrderResponse`.
// Body bỏ `note` khi trống (BE `@Size`, null hợp lệ trừ OTHER / gỡ giữ).
// - POST /orders/{id}/hold              {reasonCode, note?}   — sales-orders:APPROVE
// - POST /orders/{id}/hold/resolution   {note}                — sales-orders:APPROVE
// - POST /orders/{id}/delivery-failure  {reasonCode, note?}   — sales-orders:APPROVE
// - POST /orders/{id}/remainder-closure {reasonCode, note?}   — sales-order-cancellations:UPDATE

export type HoldOrderInput = OrderMutationVars<HoldOrderValues>;
export type ResolveOrderHoldInput = OrderMutationVars<ResolveOrderHoldValues>;
export type DeliveryFailureInput = OrderMutationVars<DeliveryFailureValues>;
export type RemainderClosureInput = OrderMutationVars<RemainderClosureValues>;

function reasonBody({ reasonCode, note }: { reasonCode: string; note: string }) {
  return note ? { reasonCode, note } : { reasonCode };
}

export function holdOrder(input: HoldOrderInput): Promise<Order> {
  return postOrderAction(input.id, "/hold", reasonBody(input), input.idempotencyKey);
}

export function resolveOrderHold(input: ResolveOrderHoldInput): Promise<Order> {
  return postOrderAction(input.id, "/hold/resolution", { note: input.note }, input.idempotencyKey);
}

export function recordDeliveryFailure(input: DeliveryFailureInput): Promise<Order> {
  return postOrderAction(input.id, "/delivery-failure", reasonBody(input), input.idempotencyKey);
}

export function closeOrderRemainder(input: RemainderClosureInput): Promise<Order> {
  return postOrderAction(input.id, "/remainder-closure", reasonBody(input), input.idempotencyKey);
}
