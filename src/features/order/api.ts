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
    customerId: dto.customerId,
    status: mapBackendOrderStatus(dto.status),
    totalAmount: dto.totalAmount,
    currency: dto.currency,
    placedAt: dto.placedAt,
    recipientName: address?.recipientName ?? dto.contactName ?? "",
    recipientPhone: address?.phone ?? dto.contactPhone ?? "",
    contactEmail: dto.contactEmail ?? null,
    shippingAddressText: addressText || null,
    lines: dto.lines.map(({ lineId, sku, quantity, unitPrice, lineTotal }) => ({
      lineId,
      sku,
      quantity,
      unitPrice,
      lineTotal,
    })),
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
