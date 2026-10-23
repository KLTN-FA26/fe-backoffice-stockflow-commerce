/**
 * Order — chỗ cắm cho "Ước tính xếp xe" (SCRUM-287 F3).
 *
 * Feature không import chéo nhau (feature-architecture.md): ngăn kéo ước tính nằm ở `features/load-planning`,
 * còn màn đơn chỉ biết một khe `estimateSlot` do chỗ ghép (`components/backoffice/OrderDetailWithLoadEstimate`)
 * truyền vào — đúng kiểu "prop drilling qua page" của luật.
 */

import type { ReactNode } from "react";

import type { OrderStatus } from "./types";

export interface OrderEstimateSlotProps {
  orderId: string;
  orderNumber: string;
  /**
   * Kho sẽ xuất hàng, khi đơn CHƯA release (hộp thoại release): BE bắt buộc `warehouseId` cho đơn CONFIRMED.
   * `null` với đơn đã release (BE dùng kho của đơn) hoặc khi chưa chọn kho.
   */
  warehouseId: string | null;
  /** Đơn đã release: không cần kho. false = CONFIRMED, cần kho. */
  released: boolean;
}

/** Khe render nút / ngăn kéo ước tính; chỗ ghép trả null nếu không có gì để hiện. */
export type OrderEstimateSlot = (props: OrderEstimateSlotProps) => ReactNode;

/**
 * Trạng thái đơn đã release mà BE ước tính được (`LoadEstimateService`): IN_PRODUCTION, READY_TO_FULFILL, PICKING,
 * PACKED, PARTIALLY_FULFILLED (phần còn lại). ON_HOLD, đã giao trở đi, DRAFT, PENDING_PAYMENT → 409
 * LOAD_ESTIMATE_SOURCE_NOT_ELIGIBLE. CONFIRMED ước tính được ở hộp thoại release (kèm kho).
 */
export const ESTIMABLE_RELEASED_STATUSES: readonly OrderStatus[] = [
  "In Production",
  "Ready to Fulfill",
  "Picking",
  "Packed",
  "Partially Fulfilled",
];
