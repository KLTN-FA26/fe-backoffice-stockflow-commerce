/**
 * Order history — API layer (`GET /orders/{id}/history`, BE `sales-orders:READ`).
 *
 * Tách khỏi `api.ts` (giới hạn 200 dòng / file). Cùng quy ước: path không có `v1`, parse zod một lần ở biên
 * rồi map DTO BE → mục đã phân loại.
 */

import { api } from "@/lib/api/client";

import { orderHistoryDtoSchema } from "./schemas";
import { mapBackendOrderStatus } from "./status-map";

import type { OrderHistoryEntry, OrderHistoryEntryDto } from "./types";

const ORDERS_PATH = "/orders";

/**
 * Mục lịch sử BE → mục đã phân loại. `STATUS_CHANGE` mà thiếu `to` (hoặc `type` lạ) không đoán được —
 * giữ thành mục "unknown" thay vì làm hỏng cả lịch sử. Pure — export để test.
 */
export function toOrderHistoryEntry(dto: OrderHistoryEntryDto): OrderHistoryEntry {
  const base = {
    occurredAt: dto.occurredAt,
    reason: dto.reason ?? null,
    actorName: dto.actorName ?? null,
  };
  if (dto.type === "PARTIAL_SHIPMENT_DECISION" && typeof dto.partialShipmentAllowed === "boolean") {
    return { ...base, kind: "partial-shipment", allowed: dto.partialShipmentAllowed };
  }
  if (dto.type === "STATUS_CHANGE" && dto.to) {
    return {
      ...base,
      kind: "status-change",
      from: dto.from ? mapBackendOrderStatus(dto.from) : null,
      to: mapBackendOrderStatus(dto.to),
    };
  }
  return { ...base, kind: "unknown" };
}

/* ── History ─────────────────────────────────────────────────────────── */
// GET /orders/{id}/history — BE `sales-orders:READ`; cũ nhất trước (BE trả đã sắp theo `occurredAt`,
// gồm cả quyết định giao một phần xen với đổi trạng thái).

export async function getOrderHistory(
  id: string,
  signal?: AbortSignal,
): Promise<OrderHistoryEntry[]> {
  const { data } = await api.get<unknown>(`${ORDERS_PATH}/${encodeURIComponent(id)}/history`, {
    signal,
  });
  return orderHistoryDtoSchema.parse(data).map(toOrderHistoryEntry);
}
