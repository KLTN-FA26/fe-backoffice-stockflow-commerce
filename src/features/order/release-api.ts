/**
 * Release đơn — API layer (BE `OrderReleaseController`, docs 17 §4.2 bước 5, §4.5, BR-03, BR-29). Tách khỏi `api.ts`
 * (giới hạn 200 dòng / file); cùng quy ước: path không có `v1`.
 *
 * - POST /orders/{id}/release {warehouseId, deliveryBatchId?} — `sales-order-releases:UPDATE` (scope ALL, quản lý kho
 *   của kho xuất; BE kiểm thêm kho người gọi phụ trách). Mọi đơn giao nguyên chuyến (docs 09 BR-08) nên KHÔNG có
 *   hình thức giao. `deliveryBatchId` (BR-29): đợt giao muốn release — phải là đợt kế tiếp của lịch giao, bỏ trống =
 *   đợt kế tiếp (409 DELIVERY_BATCH_NOT_NEXT nếu khác). Hàng giữ của đợt được phân bổ vào các thùng LPN cụ thể.
 */

import { api } from "@/lib/api/client";
import { idempotencyRequestConfig } from "@/lib/api/idempotency";

const ORDERS_PATH = "/orders";
const orderPath = (id: string) => `${ORDERS_PATH}/${encodeURIComponent(id)}`;

export interface ReleaseOrderInput {
  id: string;
  warehouseId: string;
  /** Đợt giao muốn release; vắng = đợt kế tiếp của đơn (đơn không có lịch giao thì không có đợt). */
  deliveryBatchId?: string;
  /**
   * `Idempotency-Key` của lần thử (BE `IdempotencyFilter` áp cho mọi POST): bấm lại sau lỗi nhả claim / mất mạng gửi
   * CÙNG key nên release không bị làm hai lần. Vòng đời key: `lib/api/idempotency.ts`.
   */
  idempotencyKey?: string;
}

export async function releaseOrder(input: ReleaseOrderInput): Promise<void> {
  const { id, warehouseId, deliveryBatchId, idempotencyKey } = input;
  await api.post(
    `${orderPath(id)}/release`,
    { warehouseId, ...(deliveryBatchId ? { deliveryBatchId } : {}) },
    idempotencyRequestConfig(idempotencyKey),
  );
}
