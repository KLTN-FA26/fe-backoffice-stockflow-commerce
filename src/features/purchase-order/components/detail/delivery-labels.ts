import { PO_DELIVERY_STATUS, SUPPLIER_CHANNEL_LABELS, UI_LABELS } from "@/constants";
import { isFirstDelivery } from "@/features/purchase-order";

import type { DeliveryAttempt, PoDeliveryStatus } from "@/features/purchase-order";

/** Nhãn dùng chung cho bảng lịch sử gửi (`deliveryColumns`) và panel chi tiết một dòng. */

export const channelLabel = (c: string) =>
  c === "EMAIL" || c === "API" ? SUPPLIER_CHANNEL_LABELS[c] : c;

/** Loại quyết định suy từ lượt (BE: generation 0 = gửi lần đầu, ≥1 = khôi phục gửi). */
export const decisionTypeLabel = (generation: number) =>
  isFirstDelivery(generation) ? "Gửi lần đầu" : "Khôi phục gửi";

const TEMPLATES: Record<string, string> = UI_LABELS.purchaseOrder.template;
/** BE #36 `templateCode` → nhãn (thư gửi đơn / thư báo huỷ); mã lạ hiện nguyên văn. */
export const templateLabel = (code: string) => TEMPLATES[code] ?? code;

/**
 * Kết quả một lần gửi (PENDING | SENT | FAILED) hiện bằng cùng nhãn với `deliveryStatus` của PO,
 * theo đúng ánh xạ BE `NotificationServiceImpl#purchaseOrderDeliveryStatuses` (SENT → DELIVERED).
 * Tránh trùng chữ "Đã gửi NCC" của trạng thái PO SENT.
 */
const ATTEMPT_RESULT: Record<DeliveryAttempt["status"], PoDeliveryStatus> = {
  PENDING: PO_DELIVERY_STATUS.QUEUED,
  SENT: PO_DELIVERY_STATUS.DELIVERED,
  FAILED: PO_DELIVERY_STATUS.FAILED,
};
export const attemptResult = (status: DeliveryAttempt["status"]) => ATTEMPT_RESULT[status];
