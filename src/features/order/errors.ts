/**
 * Order — mapping lỗi API sang message hiển thị.
 *
 * Branch theo `error.code` (= `errorCode` của BE, chuẩn hoá trong `lib/api/error.ts`),
 * KHÔNG theo `error.message` — message server là tiếng Anh và có thể đổi bất cứ lúc
 * nào; code là contract (BE `common/error/ErrorCode.java`).
 */

import { ORDER_ACTION_LABELS, ORDER_ERROR_MESSAGES, ORDER_LIMITS, UI_LABELS } from "@/constants";

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

export type OrderStatusActionKey = "hold" | "resolveHold" | "deliveryFailure" | "remainderClosure";

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
  const title = ORDER_ACTION_LABELS[action].failedTitle;
  if (isOrderErrorCode(error.code))
    return { title, detail: ORDER_ERROR_MESSAGES[error.code], traceId };
  switch (error.code) {
    case "VALIDATION_FAILED":
      // BE trả fieldErrors tiếng Anh ("reasonCode is required"…) — không hiện thẳng.
      return {
        title,
        detail:
          action === "resolveHold"
            ? "Hãy ghi cách đã xử lý (bắt buộc)."
            : "Hãy chọn lý do; “Lý do khác” bắt buộc có ghi chú.",
        traceId,
      };
    case "NOT_FOUND":
      return {
        title: UI_LABELS.order.notFoundTitle,
        detail: UI_LABELS.order.notFoundDescription,
        traceId,
      };
    case "FORBIDDEN":
    case "OUT_OF_DATA_SCOPE":
      return { title, detail: "Bạn không có quyền thực hiện thao tác này.", traceId };
    case "NETWORK_ERROR":
      return { title, detail: "Không kết nối được máy chủ. Vui lòng kiểm tra mạng.", traceId };
    default:
      return { title, detail: "Đã xảy ra lỗi. Vui lòng thử lại.", traceId };
  }
}
