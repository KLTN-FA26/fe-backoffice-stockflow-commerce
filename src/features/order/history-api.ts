/**
 * Order history — API layer (`GET /orders/{id}/history`, BE `sales-orders:READ`).
 *
 * Tách khỏi `api.ts` (giới hạn 200 dòng / file). Cùng quy ước: path không có `v1`, parse zod một lần ở biên
 * rồi map DTO BE → mục đã phân loại.
 */

import { api } from "@/lib/api/client";

import { orderHistoryDtoSchema } from "./history-schemas";
import { mapBackendOrderStatus } from "./status-map";

import type { OrderHistoryEntry, OrderHistoryEntryDto } from "./types";

type HistoryAddress = OrderHistoryEntryDto["newAddress"];

/** Một địa chỉ của mục đổi địa chỉ thành một dòng: người nhận · SĐT, số nhà, xã / phường, tỉnh. Trống → null. */
function addressLine(address: HistoryAddress): string | null {
  if (!address) return null;
  const who = [address.recipientName, address.phone].filter(Boolean).join(" · ");
  const where = [address.line1, address.line2, address.wardName, address.provinceName]
    .filter(Boolean)
    .join(", ");
  return [who, where].filter(Boolean).join(" — ") || null;
}

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
  if (dto.type === "REMAINDER_CLOSURE") {
    return { ...base, kind: "remainder-closure", reasonCode: dto.closureReasonCode ?? null };
  }
  if (dto.type === "DELIVERY_MODE_CHANGE" && dto.deliveryMode) {
    return {
      ...base,
      kind: "delivery-mode",
      mode: dto.deliveryMode,
      previousMode: dto.previousDeliveryMode ?? null,
    };
  }
  // WF04 G2 (docs 17 BR-16): Sale đổi địa chỉ giao trước khi dán nhãn
  const newAddress = dto.type === "ADDRESS_CHANGE" ? addressLine(dto.newAddress) : null;
  if (newAddress) {
    return {
      ...base,
      kind: "address-change",
      from: addressLine(dto.previousAddress),
      to: newAddress,
    };
  }
  // WF-05 BE-52 (TT-3): phiếu hoàn tiền bị huỷ khi còn yêu cầu trả hàng mở — không đổi trạng thái
  if (dto.type === "REFUND_VOIDED") return { ...base, kind: "refund-voided" };
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
