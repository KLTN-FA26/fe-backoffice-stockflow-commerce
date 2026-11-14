"use client";

import { ORDER_ESTIMATE_CARD_LABELS } from "@/constants";

import { ESTIMABLE_RELEASED_STATUSES } from "../estimate-slot";

import type { OrderEstimateSlot } from "../estimate-slot";
import type { Order } from "../types";

interface OrderEstimateCardProps {
  order: Pick<Order, "orderId" | "orderNumber" | "status">;
  /** Khe "Ước tính xếp xe" cho đơn đã release (xem `estimate-slot.ts`). */
  estimateSlot?: OrderEstimateSlot;
}

/**
 * Thẻ "Xếp xe" của đơn đã release: chỗ cắm nút "Ước tính xếp xe" (BE `LoadEstimateService`, SCRUM-287 F3). Chỉ hiện khi
 * trạng thái đơn ước tính được và chỗ ghép có truyền khe; mọi đơn giao nguyên chuyến (docs 09 BR-08) nên không còn
 * hình thức giao để chọn hay đổi.
 */
export function OrderEstimateCard({ order, estimateSlot }: OrderEstimateCardProps) {
  const estimate = ESTIMABLE_RELEASED_STATUSES.includes(order.status)
    ? estimateSlot?.({
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        warehouseId: null,
        released: true,
      })
    : null;
  if (!estimate) return null;
  // `empty:hidden`: chỗ ghép có thể trả phần tử không render gì (thiếu quyền ước tính) — khi đó thẻ ẩn hẳn
  return (
    <section
      aria-label={ORDER_ESTIMATE_CARD_LABELS.title}
      className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] empty:hidden"
    >
      {estimate}
    </section>
  );
}
