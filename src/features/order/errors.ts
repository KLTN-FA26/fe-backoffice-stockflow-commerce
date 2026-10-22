/**
 * Order — mapping lỗi API sang message hiển thị.
 *
 * Branch theo `error.code` (= `errorCode` của BE, chuẩn hoá trong `lib/api/error.ts`),
 * KHÔNG theo `error.message` — message server là tiếng Anh và có thể đổi bất cứ lúc
 * nào; code là contract (BE `common/error/ErrorCode.java`).
 */

import {
  ORDER_ACTION_LABELS,
  ORDER_DELIVERY_MODE_UI,
  ORDER_ERROR_MESSAGES,
  ORDER_LIMITS,
  ORDER_PARTIAL_SHIPMENT_LABELS,
  ORDER_RELEASE_LABELS,
  UI_LABELS,
} from "@/constants";

import type { ApiError } from "@/lib/api/error";

export interface OrderErrorView {
  title: string;
  detail: string;
  traceId?: string;
}

const CANCEL_FAILED = UI_LABELS.order.cancelFailedTitle;

/** Message cho lỗi admin-cancel (POST /orders/:id/admin-cancellation). */
export function adminCancelErrorView(error: ApiError): OrderErrorView {
  const traceId = error.traceId;
  switch (error.code) {
    case "VALIDATION_FAILED":
      // BE trả fieldErrors.reason bằng tiếng Anh ("reason is required") — không hiện thẳng.
      // BE @NotBlank; BE PR #42 thêm @Size(max = 500) → lỗi có thể do trống hoặc quá dài
      return {
        title: CANCEL_FAILED,
        detail: `Lý do huỷ là bắt buộc và tối đa ${ORDER_LIMITS.cancelReasonMax} ký tự.`,
        traceId,
      };
    // BE BR-031 (order/api/OrderStatus.java#canTransitionTo); docs 17 BR-03 (§6 / §4.5):
    // hàng đã bàn giao vận chuyển — phải đi flow trả hàng. Nút lẽ ra đã ẩn qua
    // allowedOrderActions; đây là lớp phòng hộ khi state đã cũ (BE hotfix #35 → 409).
    // BE PR #133: lệnh huỷ bị từ chối trả ORDER_NOT_CANCELLABLE (kiện đã đóng) / ORDER_INVALID_TRANSITION /
    // ORDER_CANCELLED thay cho CONFLICT chung; giữ CONFLICT cho BE cũ.
    case "ORDER_NOT_CANCELLABLE":
    case "ORDER_INVALID_TRANSITION":
    case "ORDER_CANCELLED":
      return { title: "Đơn không còn huỷ được", detail: ORDER_ERROR_MESSAGES[error.code], traceId };
    case "CONFLICT":
      return {
        title: "Đơn không còn huỷ được",
        // Không ghi mã BR cho người dùng; trang tự tải lại (OrderCancelAction) nên không bảo "tải lại".
        detail: "Đơn đã bàn giao vận chuyển hoặc đã đóng. Vui lòng xử lý qua luồng trả hàng.",
        traceId,
      };
    // 404 dùng chung cho "không tồn tại" và "ngoài phạm vi" — BE chủ đích không
    // tiết lộ đơn có tồn tại hay không.
    case "NOT_FOUND":
      return {
        title: UI_LABELS.order.notFoundTitle,
        detail: UI_LABELS.order.notFoundDescription,
        traceId,
      };
    case "FORBIDDEN":
    case "OUT_OF_DATA_SCOPE":
      return { title: CANCEL_FAILED, detail: "Bạn không có quyền huỷ đơn này.", traceId };
    case "NETWORK_ERROR":
      return {
        title: CANCEL_FAILED,
        detail: "Không kết nối được máy chủ. Vui lòng kiểm tra mạng.",
        traceId,
      };
    default:
      return {
        title: CANCEL_FAILED,
        detail: "Đã xảy ra lỗi khi huỷ đơn. Vui lòng thử lại.",
        traceId,
      };
  }
}

/* ── Giữ / gỡ giữ / giao thất bại / đóng phần còn lại ───────────────── */

export type OrderStatusActionKey =
  | "hold"
  | "resolveHold"
  | "deliveryFailure"
  | "remainderClosure"
  | "partialShipment"
  | "release"
  | "deliveryMode";

/** Tiêu đề lỗi theo thao tác (giao một phần có bộ nhãn riêng — nút đổi theo bật / tắt). */
const FAILED_TITLES: Readonly<Record<OrderStatusActionKey, string>> = {
  hold: ORDER_ACTION_LABELS.hold.failedTitle,
  resolveHold: ORDER_ACTION_LABELS.resolveHold.failedTitle,
  deliveryFailure: ORDER_ACTION_LABELS.deliveryFailure.failedTitle,
  remainderClosure: ORDER_ACTION_LABELS.remainderClosure.failedTitle,
  partialShipment: ORDER_PARTIAL_SHIPMENT_LABELS.failedTitle,
  release: ORDER_RELEASE_LABELS.failedTitle,
  deliveryMode: ORDER_DELIVERY_MODE_UI.dialog.failedTitle,
};

/** Câu cho 400 VALIDATION_FAILED theo thao tác — BE trả fieldErrors / message tiếng Anh, không hiện thẳng. */
const VALIDATION_DETAIL: Readonly<Record<OrderStatusActionKey, string>> = {
  hold: "Hãy chọn lý do; “Lý do khác” bắt buộc có ghi chú.",
  resolveHold: "Hãy ghi cách đã xử lý (bắt buộc).",
  deliveryFailure: "Hãy chọn lý do; “Lý do khác” bắt buộc có ghi chú.",
  // BE `Order#requireRemainderFee`: > 0, nguyên VND, ≤ giá trị phần hàng in bị đóng, kèm lý do + chi tiết
  remainderClosure:
    "Hãy chọn lý do (“Lý do khác” cần ghi chú). Khoản phí phải là số tiền nguyên VND lớn hơn 0, không vượt giá trị phần hàng in bị đóng, kèm lý do và chi tiết.",
  partialShipment: `Ghi chú tối đa ${ORDER_LIMITS.partialShipmentNoteMax} ký tự.`,
  release: "Hãy chọn kho xuất hàng và hình thức giao hợp lệ.",
  deliveryMode: `Hãy chọn hình thức giao; ghi chú tối đa ${ORDER_LIMITS.deliveryModeNoteMax} ký tự.`,
};

/**
 * Mã lỗi cho thấy dữ liệu trên màn đã cũ (đơn đã đổi trạng thái / không còn trong phạm vi) →
 * đóng dialog và tải lại đơn. Dùng cho cả huỷ đơn.
 */
export const ORDER_STALE_ERROR_CODES: readonly string[] = [
  "CONFLICT",
  "NOT_FOUND",
  "ORDER_INVALID_TRANSITION",
  "ORDER_NOT_ON_HOLD",
  "ORDER_CREDIT_HOLD_USE_APPROVAL",
  "ORDER_DESIGN_HOLD_USE_REVERIFICATION",
  "ORDER_DELIVERY_VIA_SHIPMENT",
  "ORDER_NOT_CANCELLABLE",
  "ORDER_CANCELLED",
  // BE PR #150: đơn đã đi / đóng (hoặc đã tách vì hàng có sẵn đi trước hàng in) — tải lại để thấy trạng thái thật
  "ORDER_PARTIAL_SHIPMENT_LOCKED",
  // BE PR #157: hình thức giao đã khoá (kho bắt đầu đóng gói / đơn qua đóng gói) — tải lại để thấy trạng thái thật
  "DELIVERY_MODE_LOCKED",
];

function isOrderErrorCode(code: string): code is keyof typeof ORDER_ERROR_MESSAGES {
  return code in ORDER_ERROR_MESSAGES;
}

/**
 * Message cho lỗi của bốn thao tác trạng thái đơn (BE PR #133). Mã `ORDER_*` tra thẳng bảng
 * `ORDER_ERROR_MESSAGES`; mã chung (400/403/404/mạng) theo ngữ cảnh thao tác.
 */
export function orderActionErrorView(
  error: ApiError,
  action: OrderStatusActionKey,
): OrderErrorView {
  const traceId = error.traceId;
  const title = FAILED_TITLES[action];
  if (isOrderErrorCode(error.code))
    return { title, detail: ORDER_ERROR_MESSAGES[error.code], traceId };
  switch (error.code) {
    case "VALIDATION_FAILED":
      // BE trả fieldErrors tiếng Anh ("reasonCode is required"…) — không hiện thẳng.
      return { title, detail: VALIDATION_DETAIL[action], traceId };
    case "NOT_FOUND":
      return {
        title: UI_LABELS.order.notFoundTitle,
        detail: UI_LABELS.order.notFoundDescription,
        traceId,
      };
    case "FORBIDDEN":
      // Release: 403 khi chọn hình thức khác của đơn mà thiếu `sales-order-delivery-modes:UPDATE` (BE PR #157)
      return {
        title,
        detail:
          action === "release" || action === "deliveryMode"
            ? ORDER_DELIVERY_MODE_UI.forbidden
            : "Bạn không có quyền thực hiện thao tác này.",
        traceId,
      };
    case "OUT_OF_DATA_SCOPE":
      return { title, detail: "Bạn không có quyền thực hiện thao tác này.", traceId };
    case "NETWORK_ERROR":
      return { title, detail: "Không kết nối được máy chủ. Vui lòng kiểm tra mạng.", traceId };
    default:
      return { title, detail: "Đã xảy ra lỗi. Vui lòng thử lại.", traceId };
  }
}
