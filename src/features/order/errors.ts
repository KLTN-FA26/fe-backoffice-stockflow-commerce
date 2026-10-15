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
  /** Mã BR nghiệp vụ bị vi phạm — hiển thị để Coordinator đối chiếu docs (vd BR-PRD-08). */
  rule?: string;
  /** Chi tiết gốc từ máy chủ (vd danh sách SKU thiếu mẫu duyệt) — tiếng Anh, chỉ để tham khảo. */
  serverDetail?: string;
  traceId?: string;
}

/* ── Tranh chấp đồng thời ────────────────────────────────────────────── */

/**
 * BE `ErrorCode.isRetryable` — đều 409, không kèm `fieldErrors` (GlobalExceptionHandler):
 * - OPTIMISTIC_LOCK: bản ghi đã bị người khác ghi trước (OptimisticLockingFailureException) →
 *   dữ liệu trên màn đã cũ, phải tải lại trước khi thử lại.
 * - LOCK_TIMEOUT: không lấy được khoá dòng trong thời hạn (đơn khoá PESSIMISTIC_WRITE, 3 giây) —
 *   người khác đang xử lý, giao dịch của mình chưa đổi gì → thử lại sau ít giây.
 * KHÔNG tự gửi lại: thao tác có thể không còn hợp lệ với dữ liệu mới, và chưa có Idempotency-Key —
 * người dùng tự bấm lại.
 */
export const ORDER_CONCURRENCY_CODES = ["OPTIMISTIC_LOCK", "LOCK_TIMEOUT"] as const;

export function isOrderConcurrencyError(error: ApiError): boolean {
  return (ORDER_CONCURRENCY_CODES as readonly string[]).includes(error.code);
}

/* ── fieldErrors của BE → ô form ──────────────────────────────────────── */

/**
 * Tên field BE (property của request DTO, vd `depositPercent`) → ô form + câu tiếng Việt. Message
 * của máy chủ có thể là tiếng Anh nên ô nhập dùng câu FE (cùng cách `poCreateFieldErrors`).
 */
export type ServerFieldMap<F extends string> = Readonly<
  Record<string, { field: F; message: string }>
>;

/**
 * Tách `fieldErrors` của BE thành lỗi gắn được vào ô (mọi field nhận ra) và message của field lạ
 * (field cấp lớp như `creditRefusalRequest`, field FE không có ô). Không ép kiểu tên field tuỳ ý.
 */
export function mapServerFieldErrors<F extends string>(
  error: ApiError,
  map: ServerFieldMap<F>,
): { mapped: { field: F; message: string }[]; unmapped: string[] } {
  const mapped: { field: F; message: string }[] = [];
  const unmapped: string[] = [];
  for (const [beField, message] of Object.entries(error.fieldErrors ?? {})) {
    const target = Object.hasOwn(map, beField) ? map[beField] : undefined;
    if (target) mapped.push(target);
    else unmapped.push(message);
  }
  return { mapped, unmapped };
}

/** Lỗi chung mọi thao tác: quyền, không tìm thấy, mạng. `null` → để hàm gọi xử lý tiếp. */
function commonErrorView(error: ApiError, title: string, action: string): OrderErrorView | null {
  const traceId = error.traceId;
  switch (error.code) {
    case "OPTIMISTIC_LOCK":
      return {
        title,
        detail:
          "Đơn vừa được người khác cập nhật. Dữ liệu đơn đã được tải lại — kiểm tra lại rồi bấm thử lại nếu vẫn cần.",
        traceId,
      };
    case "LOCK_TIMEOUT":
      return {
        title,
        detail: "Đơn đang được xử lý ở nơi khác. Đợi vài giây rồi bấm thử lại.",
        traceId,
      };
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

/** BE `AdminCancelOrderRequest` (`reason` cũ FE không gửi → rơi vào lỗi chung). */
export const ADMIN_CANCEL_FIELD_ERRORS = {
  reasonCode: { field: "reasonCode", message: "Chọn lý do huỷ hợp lệ." },
  note: {
    field: "note",
    message: `Ghi chú tối đa ${ORDER_LIMITS.cancelNoteMax} ký tự (bắt buộc với lý do khác).`,
  },
  retainedPercent: { field: "retainedPercent", message: "Tỷ lệ giữ lại phải từ 0 đến 100%." },
} as const satisfies ServerFieldMap<"reasonCode" | "note" | "retainedPercent">;

/* ── Release (SCRUM-423) ─────────────────────────────────────────────── */

/** BE `ReleaseOrderRequest(@NotNull warehouseId)`. */
export const RELEASE_FIELD_ERRORS = {
  warehouseId: { field: "warehouseId", message: "Chọn kho xuất." },
} as const satisfies ServerFieldMap<"warehouseId">;

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

const CREDIT_NOTE_FIELD = {
  field: "note",
  message: `Ghi chú là bắt buộc, tối đa ${ORDER_LIMITS.creditNoteMax} ký tự.`,
} as const;

/** BE `CreditDecisionRequest(note)` — duyệt chỉ có ghi chú. */
export const CREDIT_APPROVAL_FIELD_ERRORS = {
  note: CREDIT_NOTE_FIELD,
} as const satisfies ServerFieldMap<"note">;

/** BE `CreditRefusalRequest(action, depositPercent, note)`. */
export const CREDIT_REJECTION_FIELD_ERRORS = {
  action: { field: "action", message: "Chọn cách xử lý." },
  depositPercent: {
    field: "depositPercent",
    message: `Tỷ lệ cọc phải lớn hơn ${ORDER_LIMITS.depositPercentMin}% và nhỏ hơn ${ORDER_LIMITS.depositPercentMax}%.`,
  },
  note: CREDIT_NOTE_FIELD,
} as const satisfies ServerFieldMap<"action" | "depositPercent" | "note">;

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
