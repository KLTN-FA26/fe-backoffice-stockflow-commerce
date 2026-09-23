/**
 * Order — mapping lỗi API sang message hiển thị.
 *
 * Branch theo `error.code`, KHÔNG theo `error.message.includes(...)` — message là
 * text hiển thị, có thể đổi bất cứ lúc nào; code là contract.
 */

import type { ApiError } from "@/lib/api/error";

export interface OrderErrorView {
  title: string;
  detail: string;
}

/** Message cho lỗi admin-cancel (POST /orders/:id/admin-cancellation). */
export function adminCancelErrorView(error: ApiError): OrderErrorView {
  switch (error.code) {
    case "VALIDATION_FAILED":
      return {
        title: "Không huỷ được đơn",
        detail: error.fieldErrors?.reason ?? "Lý do huỷ là bắt buộc",
      };
    // BE BR-031 (Order.java / OrderStatus.java); docs 17 BR-03 (§6 / §4.5):
    // hàng đã bàn giao vận chuyển — phải đi flow trả hàng. Nút lẽ ra đã ẩn qua
    // allowedOrderActions; đây là lớp phòng hộ khi state đã cũ. BE hotfix #35
    // (đã merge vào develop) đổi lỗi sai trạng thái từ 400 → 409 CONFLICT nên
    // nhánh này giờ chạy đúng với API thật.
    case "CONFLICT":
      return {
        title: "Đơn không còn huỷ được",
        detail:
          "Đơn đã bàn giao vận chuyển. Vui lòng xử lý qua luồng trả hàng (BE BR-031; docs BR-03).",
      };
    // 404 dùng chung cho "không tồn tại" và "ngoài phạm vi" — BE chủ đích không
    // tiết lộ đơn có tồn tại hay không, UI không bao giờ nói "không có quyền".
    case "NOT_FOUND":
      return { title: "Không tìm thấy đơn hàng", detail: "Đơn hàng không tồn tại." };
    default:
      return { title: "Không huỷ được đơn", detail: error.message };
  }
}
