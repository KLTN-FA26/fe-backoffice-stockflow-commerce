/**
 * Partial shipment — API layer (`PUT /orders/{id}/partial-shipment`, BE PR #150).
 *
 * Tách khỏi `api.ts` (giới hạn 200 dòng / file); cùng quy ước: path không có `v1`.
 */

import { api } from "@/lib/api/client";

import type { PartialShipmentValues } from "./schemas";

const ORDERS_PATH = "/orders";

// PUT /orders/{id}/partial-shipment {allowed, note?} — BE `sales-order-partial-shipments:UPDATE`
// (scope ALL). Trả `Order`; 409 ORDER_PARTIAL_SHIPMENT_LOCKED khi đơn đã đi / đóng hoặc hàng có sẵn đã đi
// trước hàng in. Quyết định không đổi gì (bật khi đã bật) BE không ghi vào lịch sử.

export type PartialShipmentInput = { id: string } & PartialShipmentValues;

export async function decidePartialShipment(input: PartialShipmentInput): Promise<void> {
  const { id, allowed, note } = input;
  await api.put(`${ORDERS_PATH}/${encodeURIComponent(id)}/partial-shipment`, {
    allowed,
    ...(note ? { note } : {}),
  });
}
