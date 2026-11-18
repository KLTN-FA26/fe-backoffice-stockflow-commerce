/**
 * Shipping — action-gating sự kiện hãng vận chuyển (feature-architecture §6; docs 09 §4.5 bước 8). Chỉ sự kiện thuộc
 * danh sách lỗi mới đánh dấu đã xử lý được, và chỉ một lần (BE `CARRIER_EVENT_NOT_RESOLVABLE`). BE không có thao tác áp lại
 * sự kiện nên không có action "áp lại". Mã quyền là UI-only — Backend phải re-check.
 */

import {
  CARRIER_EVENT_ERROR_RESULTS,
  CARRIER_EVENT_STATUS_KEYS,
  CARRIER_EVENT_ERRORS_FILTER,
  FULFILLMENT_CARRIER_EVENT_PERMISSIONS,
} from "@/constants";

import type { ShippingActor } from "./lifecycle";
import type { CarrierEventRow } from "./carrier-event-types";

/** Kết quả này thuộc danh sách lỗi (không bao giờ tự áp lại, xử lý tay)? */
export function isErrorListResult(result: string): boolean {
  return (CARRIER_EVENT_ERROR_RESULTS as readonly string[]).includes(result);
}

/** Sự kiện lỗi chưa được đánh dấu đã xử lý. */
export function isOpenError(event: Pick<CarrierEventRow, "result" | "resolvedAt">): boolean {
  return isErrorListResult(event.result) && !event.resolvedAt;
}

export interface CarrierEventActions {
  /** Đánh dấu đã xử lý (`fulfillment-carrier-events:UPDATE`). */
  resolve: boolean;
}

export function carrierEventActions(
  actor: ShippingActor,
  event: Pick<CarrierEventRow, "result" | "resolvedAt">,
): CarrierEventActions {
  return {
    resolve: actor.can(FULFILLMENT_CARRIER_EVENT_PERMISSIONS.update) && isOpenError(event),
  };
}

/** Khoá của `status-map` (tông màu + nhãn tiếng Việt) cho một kết quả xử lý sự kiện. */
export function carrierEventStatusKey(result: string): string {
  return result === "RECEIVED" ? CARRIER_EVENT_STATUS_KEYS.RECEIVED : result;
}

/** Lựa chọn "mọi sự kiện" của bộ lọc kết quả (không gửi `result` cho BE). */
export const CARRIER_EVENT_ALL_FILTER = "ALL";

/** Giá trị `result=` gửi BE cho một lựa chọn lọc; `ALL` = không lọc. */
export function resultParam(filter: string): string | undefined {
  return filter === CARRIER_EVENT_ALL_FILTER ? undefined : filter;
}

/** Lọc đang xem danh sách lỗi (cả danh sách hoặc một kết quả lỗi) — chỉ lúc đó lọc "đã / chưa xử lý" mới có nghĩa. */
export function isErrorFilter(filter: string): boolean {
  return filter === CARRIER_EVENT_ERRORS_FILTER || isErrorListResult(filter);
}
