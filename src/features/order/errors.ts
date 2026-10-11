/**
 * Order — mapping lỗi API sang message hiển thị.
 *
 * Branch theo `error.code` (= `errorCode` của BE, chuẩn hoá trong `lib/api/error.ts`),
 * KHÔNG theo `error.message` — message server là tiếng Anh và có thể đổi bất cứ lúc
 * nào; code là contract (BE `common/error/ErrorCode.java`).
 */

import { UI_LABELS } from "@/constants";

import type { ApiError } from "@/lib/api/error";

export interface OrderErrorView {
  title: string;
  detail: string;
  /** Mã BR nghiệp vụ bị vi phạm — hiển thị để Coordinator đối chiếu docs (vd BR-PRD-08). */
  rule?: string;
  /** Chi tiết gốc từ máy chủ (vd danh sách SKU thiếu mẫu duyệt) — tiếng Anh, chỉ để tham khảo. */
  serverDetail?: string;
  traceId?: string;
}

/** Lỗi chung mọi thao tác: quyền, không tìm thấy, mạng. `null` → để hàm gọi xử lý tiếp. */
function commonErrorView(error: ApiError, title: string, action: string): OrderErrorView | null {
  const traceId = error.traceId;
  switch (error.code) {
    // 404 dùng chung cho "không tồn tại" và "ngoài phạm vi" — BE chủ đích không tiết lộ.
    case "NOT_FOUND":
      return {
        title: UI_LABELS.order.notFoundTitle,
        detail: UI_LABELS.order.notFoundDescription,
        traceId,
      };
    case "FORBIDDEN":
    case "OUT_OF_DATA_SCOPE":
      return { title, detail: `Bạn không có quyền ${action}.`, traceId };
    case "NETWORK_ERROR":
      return { title, detail: "Không kết nối được máy chủ. Vui lòng kiểm tra mạng.", traceId };
    default:
      return null;
  }
}

function fallback(error: ApiError, title: string, action: string): OrderErrorView {
  return {
    title,
    detail: `Đã xảy ra lỗi khi ${action}. Vui lòng thử lại.`,
    traceId: error.traceId,
  };
}

/* ── Admin cancel ────────────────────────────────────────────────────── */

const CANCEL_FAILED = UI_LABELS.order.cancelFailedTitle;

export function adminCancelErrorView(error: ApiError): OrderErrorView {
  const traceId = error.traceId;
  switch (error.code) {
    case "VALIDATION_FAILED":
      // BE Order#cancelByAdmin: reasonCode OTHER thiếu note, hoặc retainedPercent ngoài 0..100
      return {
        title: CANCEL_FAILED,
        detail: "Kiểm tra lại lý do huỷ, ghi chú (bắt buộc với lý do khác) và tỷ lệ giữ lại.",
        traceId,
      };
    // BE BR-031 (OrderStatus#canTransitionTo); docs 17 BR-03 (§6 / §4.5): hàng đã bàn giao vận
    // chuyển — phải đi flow trả hàng. Nút lẽ ra đã ẩn qua allowedOrderActions; đây là lớp phòng
    // hộ khi state đã cũ. BE develop trả ORDER_NOT_CANCELLABLE; CONFLICT giữ cho bản BE cũ.
    case "ORDER_NOT_CANCELLABLE":
    case "CONFLICT":
      return {
        title: "Đơn không còn huỷ được",
        detail: "Đơn đã bàn giao vận chuyển hoặc đã đóng. Vui lòng xử lý qua luồng trả hàng.",
        rule: "BR-03",
        traceId,
      };
    default:
      return (
        commonErrorView(error, CANCEL_FAILED, "huỷ đơn này") ??
        fallback(error, CANCEL_FAILED, "huỷ đơn")
      );
  }
}

/* ── Release (SCRUM-423) ─────────────────────────────────────────────── */

const RELEASE_REFUSED = UI_LABELS.order.releaseRefusedTitle;

/** Thứ tự kiểm ở BE: kho → mẫu duyệt → công nợ quá hạn → cọc → trạng thái (OrderReleaseService). */
export function releaseErrorView(error: ApiError): OrderErrorView {
  const traceId = error.traceId;
  const serverDetail = error.message || undefined;
  switch (error.code) {
    // docs 19 BR-08 / docs 17 BR-09: dòng thiết kế mới chưa có mẫu khách duyệt không được release
    case "DESIGN_SAMPLE_NOT_APPROVED":
      return {
        title: RELEASE_REFUSED,
        detail:
          "Đơn có dòng in dùng thiết kế mới chưa có mẫu được khách duyệt. Cần mẫu Approved trước khi sản xuất.",
        rule: "BR-PRD-08",
        serverDetail,
        traceId,
      };
    // docs 19 BR-09 / docs 15 BR-02: đơn đặt cọc chỉ release khi tiền cọc đã về
    case "ORDER_DEPOSIT_NOT_RECEIVED":
      return {
        title: RELEASE_REFUSED,
        detail: "Đơn đặt cọc chưa nhận đủ tiền cọc. Chờ kế toán ghi nhận cọc rồi release lại.",
        rule: "BR-PRD-09",
        traceId,
      };
    // docs 14 edge case "Khách quá hạn công nợ" + docs 17 BR-02
    case "CUSTOMER_CREDIT_OVERDUE":
      return {
        title: RELEASE_REFUSED,
        detail:
          "Khách đang có công nợ quá hạn. Cần thu phần quá hạn trước khi release đơn công nợ.",
        rule: "BR-02",
        traceId,
      };
    case "WAREHOUSE_NOT_FOUND":
      return {
        title: RELEASE_REFUSED,
        detail: "Kho xuất đã chọn không tồn tại. Chọn kho khác.",
        traceId,
      };
    // docs 17 BR-02: chỉ release đơn đủ điều kiện (Confirmed); state trên màn có thể đã cũ
    case "CONFLICT":
      return {
        title: RELEASE_REFUSED,
        detail: "Đơn không còn ở trạng thái được release (đã release, đang tạm giữ hoặc đã huỷ).",
        rule: "BR-02",
        serverDetail,
        traceId,
      };
    default:
      return (
        commonErrorView(error, RELEASE_REFUSED, "release đơn") ??
        fallback(error, RELEASE_REFUSED, "release đơn")
      );
  }
}

/* ── Credit hold (SCRUM-427) ─────────────────────────────────────────── */

const CREDIT_FAILED = UI_LABELS.order.creditFailedTitle;

export function creditDecisionErrorView(error: ApiError): OrderErrorView {
  const traceId = error.traceId;
  switch (error.code) {
    case "ORDER_NOT_ON_CREDIT_HOLD":
      return {
        title: CREDIT_FAILED,
        detail: "Đơn không còn chờ duyệt vượt hạn mức (đã được người khác xử lý).",
        traceId,
      };
    // docs 14 BR-05: chỉ dùng phương thức thanh toán được phép cho khách
    case "PAYMENT_TERM_NOT_ALLOWED":
      return {
        title: CREDIT_FAILED,
        detail: "Khách không được phép dùng phương thức thanh toán đã chọn. Chọn cách xử lý khác.",
        rule: "BR-05",
        traceId,
      };
    case "VALIDATION_FAILED":
      return { title: CREDIT_FAILED, detail: "Kiểm tra lại ghi chú và tỷ lệ cọc.", traceId };
    default:
      return (
        commonErrorView(error, CREDIT_FAILED, "duyệt vượt hạn mức") ??
        fallback(error, CREDIT_FAILED, "xử lý đơn")
      );
  }
}

/* ── Lệnh sản xuất (CONTRACT PENDING) ───────────────────────────────── */

/**
 * BE chưa có endpoint → 404 (không route) / 405. Phân biệt với lỗi thật để UI báo trung thực.
 * Chỉ gọi sau khi `GET /orders/{id}` đã thành công (đơn tồn tại, trong phạm vi) nên 404 ở đây là
 * "không có route". Khi BE thêm endpoint (trả 404 NOT_FOUND cho đơn ngoài phạm vi) cần xem lại.
 */
export function isProductionApiUnavailable(error: ApiError): boolean {
  return error.status === 404 || error.status === 405 || error.status === 501;
}
