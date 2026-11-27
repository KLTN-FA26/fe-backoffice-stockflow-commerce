/**
 * Shipping — thời điểm giao Quản lý kho nhập khi ghi tay "đã giao" (docs 09 §4.3 bước 2; 21 e-invoice §4.1: ngày lập
 * hoá đơn = ngày giao hãng báo lại). Ô ngày giờ (`DateTimePicker`, giá trị `yyyy-MM-ddTHH:mm`) theo giờ Việt Nam, như giờ hẹn lấy hàng
 * ở `booking.ts`. Pure — không gọi mạng. BE (`SHIPMENT_DELIVERY_TIME_*`) kiểm lại mọi luật dưới đây.
 */

import { SHIPPING_DELIVERY_TIME_MESSAGES as M } from "@/constants";

import { pickupInstant } from "./booking";

/**
 * Lỗi của thời điểm giao nhập vào, hoặc `null` nếu dùng được. Rỗng = không nhập (BE lấy lúc ghi nhận) nên không lỗi.
 * Không ở tương lai; không trước lúc lô được bàn giao cho hãng (BE `SHIPMENT_DELIVERY_TIME_*`).
 */
export function deliveryTimeProblem(
  local: string,
  limits: { handedOverAt?: string | null; now?: Date },
): string | null {
  if (!local) return null;
  const at = pickupInstant(local);
  if (!at) return M.invalid;
  const when = new Date(at).getTime();
  if (when > (limits.now ?? new Date()).getTime()) return M.future;
  if (limits.handedOverAt && when < new Date(limits.handedOverAt).getTime()) {
    return M.beforeHandover;
  }
  return null;
}

/**
 * Hai giá trị ô `datetime-local` (giờ Việt Nam) cùng một ngày nghiệp vụ — như BE so ngày giao (Asia/Ho_Chi_Minh) khi quyết
 * một lần sửa về "đã giao" là lần giao cũ hay lần giao mới (audit r3 EINV-1).
 */
export function sameBusinessDay(local: string, other: string): boolean {
  return local.slice(0, 10) === other.slice(0, 10);
}

/**
 * Thời điểm gửi BE (`deliveredAt`, Instant ISO): chỉ gửi khi người dùng ĐÃ SỬA ô — để nguyên thì BE lấy đúng lúc ghi
 * nhận, không phụ thuộc đồng hồ trình duyệt.
 */
export function deliveredAtToSend(local: string, edited: boolean): string | undefined {
  return edited && local ? pickupInstant(local) : undefined;
}
