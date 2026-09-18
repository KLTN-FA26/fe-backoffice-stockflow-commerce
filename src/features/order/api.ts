/**
 * Order — API layer.
 *
 * Thin wrappers around axios calls. When USE_MOCK=true the mock adapter
 * intercepts these and returns data from mock-data.ts.
 *
 * Nguồn BE: OrderController (nhánh feature/SCRUM-242-245-order-cancellation-and-history,
 * chưa merge — đọc qua git show/diff, chưa checkout).
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";
import type { PaginatedResponse, ListQueryParams } from "@/lib/api/query-factory";
import type { Order, OrderEvent, OrderStatus } from "./types";

/* ── List ────────────────────────────────────────────────────────────── */

export interface ListOrderParams extends ListQueryParams {
  status?: OrderStatus[];
}

export async function listOrders(
  params: ListOrderParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Order>> {
  const { data } = await api.get<PaginatedResponse<Order>>("/orders", {
    params: { ...params, size: params.size ?? PAGE_SIZE.masterData },
    signal,
  });
  return data;
}

/* ── Detail ──────────────────────────────────────────────────────────── */

export async function getOrder(id: string, signal?: AbortSignal): Promise<Order> {
  const { data } = await api.get<Order>(`/orders/${id}`, { signal });
  return data;
}

/* ── Events (timeline) ───────────────────────────────────────────────── */
// ASSUMPTION (open-question Tú): BE nhánh SCRUM-242/245 chưa có endpoint events;
// path dưới đây là quy ước tạm, chạy trên mock adapter. Xác nhận lại trước khi
// cắt sang API thật.

export async function getOrderEvents(id: string, signal?: AbortSignal): Promise<OrderEvent[]> {
  const { data } = await api.get<OrderEvent[]>(`/orders/${id}/events`, { signal });
  return data;
}

/* ── Admin cancel ────────────────────────────────────────────────────── */
// POST /api/v1/orders/{orderId}/admin-cancellation — scope ALL, body JSON {reason}
// bắt buộc (@NotBlank). Đây là flow riêng, KHÔNG chung với self-cancel của khách
// (POST .../cancellation, scope OWN) — hai flow khác quyền, không share logic.

export interface AdminCancelOrderInput {
  id: string;
  reason: string;
}

export async function adminCancelOrder(input: AdminCancelOrderInput): Promise<void> {
  const { id, reason } = input;
  await api.post(`/orders/${id}/admin-cancellation`, { reason });
}
