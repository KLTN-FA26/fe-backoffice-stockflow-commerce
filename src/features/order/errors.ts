/**
 * Order — mapping lỗi API sang message hiển thị.
 *
 * Branch theo `error.code` (= `errorCode` của BE, chuẩn hoá trong `lib/api/error.ts`),
 * KHÔNG theo `error.message` — message server là tiếng Anh và có thể đổi bất cứ lúc
 * nào; code là contract (BE `common/error/ErrorCode.java`).
 */

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
      return { title: CANCEL_FAILED, detail: "Lý do huỷ là bắt buộc.", traceId };
    // BE BR-031 (order/api/OrderStatus.java#canTransitionTo); docs 17 BR-03 (§6 / §4.5):
    // hàng đã bàn giao vận chuyển — phải đi flow trả hàng. Nút lẽ ra đã ẩn qua
    // allowedOrderActions; đây là lớp phòng hộ khi state đã cũ (BE hotfix #35 → 409).
    case "CONFLICT":
      return {
        title: "Đơn không còn huỷ được",
        detail:
          "Đơn đã bàn giao vận chuyển hoặc đã đóng. Vui lòng tải lại trang và xử lý qua luồng trả hàng (BE BR-031; docs BR-03).",
        traceId,
      };
    // 404 dùng chung cho "không tồn tại" và "ngoài phạm vi" — BE chủ đích không
    // tiết lộ đơn có tồn tại hay không.
    case "NOT_FOUND":
      return { title: "Không tìm thấy đơn hàng", detail: "Đơn hàng không tồn tại.", traceId };
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
