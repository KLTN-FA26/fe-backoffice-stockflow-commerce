/**
 * Đợt giao — vòng đời của TRẠNG THÁI HIỂN THỊ (docs 17 §5.5). Đợt giao không phải chứng từ riêng: trạng thái do hệ thống
 * tính từ hàng đã giữ, lô giao và kết quả giao, không ai chuyển tay — bảng dưới chỉ để đối chiếu docs và để test, UI không
 * có thao tác chuyển trạng thái. Mã BE: AWAITING_STOCK / READY / IN_DELIVERY / DELIVERED / CLOSED.
 */

import type { DELIVERY_BATCH_STATES } from "./delivery-batch-schemas";

export type DeliveryBatchState = (typeof DELIVERY_BATCH_STATES)[number];

/** docs 17 §5.5 "Chuyển tiếp cho phép" (`Awaiting Stock` → `Ready`…). Terminal = rỗng. */
export const DELIVERY_BATCH_TRANSITIONS: Readonly<
  Record<DeliveryBatchState, readonly DeliveryBatchState[]>
> = {
  AWAITING_STOCK: ["READY", "CLOSED"],
  READY: ["IN_DELIVERY", "AWAITING_STOCK"],
  IN_DELIVERY: ["DELIVERED", "CLOSED"],
  DELIVERED: [],
  CLOSED: [],
};

/**
 * Trạng thái mà CHƯA có thùng nào của đợt được bàn giao — docs 17 BR-28 chỉ cho dời cửa sổ giao ở đây. `In Delivery` /
 * `Delivered` đã bàn giao; `Closed` là đơn huỷ / đóng nên lịch không dời nữa.
 */
export const WINDOW_MOVABLE_STATES: readonly DeliveryBatchState[] = ["AWAITING_STOCK", "READY"];
