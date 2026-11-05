/**
 * Release đơn + hình thức giao — API layer (BE PR #157, LP-1/LP-2). Tách khỏi `api.ts` (giới hạn 200 dòng / file);
 * cùng quy ước: path không có `v1`.
 *
 * - POST /orders/{id}/release {warehouseId, deliveryMode?} — `sales-orders:APPROVE` (scope ALL). `deliveryMode`
 *   bỏ trống = giữ hình thức của đơn; khác hình thức của đơn thì cần thêm `sales-order-delivery-modes:UPDATE`
 *   (403 nếu thiếu). 409 DELIVERY_MODE_FTL_NO_COD: không release gì cả.
 * - PUT /orders/{id}/delivery-mode {deliveryMode, note?} — `sales-order-delivery-modes:UPDATE`; trả `Order`.
 *   409 DELIVERY_MODE_LOCKED (đã đóng gói / qua đóng gói / huỷ / đóng), 409 DELIVERY_MODE_FTL_NO_COD. Đặt lại đúng
 *   hình thức hiện tại = không làm gì, không ghi lịch sử.
 */

import { api } from "@/lib/api/client";
import { idempotencyRequestConfig } from "@/lib/api/idempotency";

import type { DeliveryModeValues } from "./input-schemas";
import type { Order, OrderDeliveryMode } from "./types";

const ORDERS_PATH = "/orders";
const orderPath = (id: string) => `${ORDERS_PATH}/${encodeURIComponent(id)}`;

export interface ReleaseOrderInput {
  id: string;
  warehouseId: string;
  /** Chỉ truyền khi KHÁC hình thức hiện tại của đơn (xem `releaseDeliveryMode`). */
  deliveryMode?: OrderDeliveryMode;
  /**
   * `Idempotency-Key` của lần thử (BE `IdempotencyFilter` áp cho mọi POST): bấm lại sau lỗi nhả claim / mất mạng gửi
   * CÙNG key nên release không bị làm hai lần. Vòng đời key: `lib/api/idempotency.ts`.
   */
  idempotencyKey?: string;
}

export async function releaseOrder(input: ReleaseOrderInput): Promise<void> {
  const { id, warehouseId, deliveryMode, idempotencyKey } = input;
  await api.post(
    `${orderPath(id)}/release`,
    { warehouseId, ...(deliveryMode ? { deliveryMode } : {}) },
    idempotencyRequestConfig(idempotencyKey),
  );
}

/**
 * Hình thức gửi kèm release: chỉ khi người dùng chọn KHÁC hình thức hiện tại của đơn — bỏ trống nghĩa là "giữ
 * nguyên" nên không cần mã `sales-order-delivery-modes:UPDATE` và không ghi lịch sử. `current` là null / "UNKNOWN"
 * (BE không trả hoặc giá trị lạ) → không biết đã đổi chưa, gửi lựa chọn của người dùng để không bị bỏ.
 */
export function releaseDeliveryMode(
  chosen: OrderDeliveryMode,
  current: Order["deliveryMode"],
): OrderDeliveryMode | undefined {
  return chosen === current ? undefined : chosen;
}

export type ChangeDeliveryModeInput = { id: string } & DeliveryModeValues;

export async function changeDeliveryMode(input: ChangeDeliveryModeInput): Promise<void> {
  const { id, deliveryMode, note } = input;
  await api.put(`${orderPath(id)}/delivery-mode`, { deliveryMode, ...(note ? { note } : {}) });
}
