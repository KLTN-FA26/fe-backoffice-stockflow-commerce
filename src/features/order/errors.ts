/**
 * Order — mapping lỗi API sang message hiển thị.
 *
 * Branch theo `error.code` (= `errorCode` của BE, chuẩn hoá trong `lib/api/error.ts`),
 * KHÔNG theo `error.message` — message server là tiếng Anh và có thể đổi bất cứ lúc
 * nào; code là contract (BE `common/error/ErrorCode.java`).
 */

import { ORDER_LIMITS, UI_LABELS } from "@/constants";

import type { ApiError } from "@/lib/api/error";

export interface OrderErrorView {
  title: string;
  detail: string;
  traceId?: string;
}

const CANCEL_FAILED = "Không huỷ được đơn";

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
