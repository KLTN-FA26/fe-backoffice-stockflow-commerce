/**
 * Shipping — đọc và diễn giải việc BE chặn bàn giao một xe (docs 09 §4.2 bước 8, BR-04, BR-18: tất cả hoặc không).
 *
 * - `409 LOAD_HANDOVER_BLOCKED` kèm `details.orders[]`: từng đơn không được phép đi, mã lý do (`ORDER_BALANCE_NOT_PAID`,
 *   `DELIVERY_BATCH_WINDOW_NOT_OPEN`, `ORDER_INVALID_TRANSITION`…), số tiền đợt còn thiếu, đợt giao và ngày mở cửa sổ giao.
 * - `HandoverWarning` trong câu trả lời của "bắt đầu xếp" cùng hình dạng — cảnh báo sớm, chưa chặn.
 * - `409 LOAD_WAYBILL_MISSING`: chưa có mã vận đơn (BR-23) → mở nhập mã vận đơn.
 * `details` là dữ liệu mạng nên parse bằng zod; sai hình thì coi như không có danh sách (không vỡ luồng lỗi).
 */

import { z } from "zod";

import { SHIPPING_ERROR_MESSAGES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";

import { handoverWarningSchema } from "./ftl-schemas";

import type { HandoverWarning } from "./types";

const B = UI_LABELS.shipping.waybill.blocked;
const detailsSchema = z.object({ orders: z.array(handoverWarningSchema) });

/** Các đơn chặn bàn giao khi lỗi là `LOAD_HANDOVER_BLOCKED`; `undefined` với lỗi khác hoặc `details` sai hình. */
export function handoverBlockedOrders(error: unknown): readonly HandoverWarning[] | undefined {
  if (!(error instanceof ApiError) || error.code !== "LOAD_HANDOVER_BLOCKED") return undefined;
  const parsed = detailsSchema.safeParse(error.details);
  return parsed.success ? parsed.data.orders : undefined;
}

/** Lỗi 409 LOAD_WAYBILL_MISSING: chuyến chưa có mã vận đơn nên chưa ký được (BR-23). */
export function isWaybillMissingError(error: unknown): boolean {
  return error instanceof ApiError && error.code === "LOAD_WAYBILL_MISSING";
}

/** Số tiền còn thiếu của một đơn (null khi lý do không phải chưa thu tiền hoặc BE không gửi tiền tệ). */
function dueText(order: HandoverWarning): string | null {
  if (!order.amountDue || order.amountDue <= 0) return null;
  return order.currency ? formatMoney(order.amountDue, order.currency) : String(order.amountDue);
}

/** Câu tiếng Việt cho lý do một đơn chưa được phép đi — theo `reasonCode` của BE, kèm số tiền / đợt giao / ngày mở cửa sổ. */
export function handoverBlockReason(order: HandoverWarning): string {
  const seq = order.deliveryBatchSeq;
  switch (order.reasonCode) {
    case "ORDER_BALANCE_NOT_PAID": {
      const due = dueText(order);
      if (!due) return SHIPPING_ERROR_MESSAGES.ORDER_BALANCE_NOT_PAID;
      return seq != null ? B.unpaidBatch(due, seq) : B.unpaid(due);
    }
    case "DELIVERY_BATCH_WINDOW_NOT_OPEN": {
      if (!order.windowStart) return SHIPPING_ERROR_MESSAGES.DELIVERY_BATCH_WINDOW_NOT_OPEN;
      const date = formatDate(order.windowStart);
      return seq != null ? B.windowNotOpenBatch(date, seq) : B.windowNotOpen(date);
    }
    case "ORDER_INVALID_TRANSITION":
      return B.onHold;
    case "ORDER_CANCELLED":
      return B.cancelled;
    default:
      return B.other;
  }
}
