/**
 * Order — mapping lỗi API sang message hiển thị.
 *
 * Branch theo `error.code` (= `errorCode` của BE, chuẩn hoá trong `lib/api/error.ts`),
 * KHÔNG theo `error.message` — message server là tiếng Anh và có thể đổi bất cứ lúc
 * nào; code là contract (BE `common/error/ErrorCode.java`, develop 5683fe14).
 *
 * Không gộp mọi 409: dữ liệu cũ (tải lại), tranh chấp khoá (thử lại sau), yêu cầu đang chạy
 * (không phát yêu cầu mới), key idempotency dùng sai, và quy tắc nghiệp vụ (xử lý nguyên nhân)
 * là các nhóm khác nhau — xem `orderErrorCategory`.
 */

import { ORDER_ACTION_LABELS, ORDER_ERROR_MESSAGES, ORDER_LIMITS, UI_LABELS } from "@/constants";

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
 * - IDEMPOTENT_REQUEST_IN_PROGRESS (409, `IdempotencyFilter`): một request cùng Idempotency-Key
 *   vẫn đang chạy — bấm lại sau ít giây (cùng key) sẽ nhận kết quả của nó.
 * KHÔNG tự gửi lại: thao tác có thể không còn hợp lệ với dữ liệu mới — người dùng tự bấm lại.
 */
export const ORDER_CONCURRENCY_CODES = [
  "OPTIMISTIC_LOCK",
  "LOCK_TIMEOUT",
  "IDEMPOTENT_REQUEST_IN_PROGRESS",
] as const;

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

/* ── Phân nhóm lỗi theo ngữ nghĩa BE ─────────────────────────────────── */

/**
 * Mã cho thấy dữ liệu trên màn đã cũ — đơn đã đổi trạng thái / người khác đã xử lý → đóng dialog và
 * tải lại đơn (nút tự ẩn theo trạng thái mới). Dùng cho huỷ + bốn thao tác trạng thái. KHÔNG gồm
 * OPTIMISTIC_LOCK (giữ dialog + dữ liệu đã nhập, xem `ORDER_CONCURRENCY_CODES`).
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
  // Người khác đã duyệt / từ chối (hoặc đơn không còn giữ công nợ) — CreditHoldService#decide
  "ORDER_NOT_ON_CREDIT_HOLD",
];

export type OrderErrorCategory =
  /** Dữ liệu trên màn đã cũ → tải lại đơn (OPTIMISTIC_LOCK + `ORDER_STALE_ERROR_CODES`). */
  | "stale"
  /** Tranh chấp khoá / quá tải — giao dịch chưa ghi gì → đợi rồi bấm lại (cùng key). */
  | "retry-later"
  /** Yêu cầu cùng Idempotency-Key đang chạy → KHÔNG phát thao tác mới, đợi kết quả của nó. */
  | "in-progress"
  /** Key idempotency đã gắn với yêu cầu khác — yêu cầu này chưa thực hiện; không tự thử lại. */
  | "idempotency-misuse"
  /** Quy tắc nghiệp vụ chặn (cọc chưa về, phương thức không được phép…) → xử lý nguyên nhân. */
  | "business"
  /** Body / tham số sai (400) → sửa dữ liệu nhập. */
  | "validation"
  | "forbidden"
  | "network"
  | "unknown";

const BUSINESS_RULE_CODES: readonly string[] = [
  "ORDER_BALANCE_NOT_PAID",
  "PAYMENT_TERM_NOT_ALLOWED",
  "CANCELLATION_FEE_BEFORE_PRINTING",
  "DESIGN_SAMPLE_NOT_APPROVED",
  "ORDER_DEPOSIT_NOT_RECEIVED",
  "CUSTOMER_CREDIT_OVERDUE",
  "WAREHOUSE_NOT_FOUND",
];

/** Nhóm ngữ nghĩa của lỗi — quyết định tải lại, thử lại, hay sửa dữ liệu (không phải mọi 409 như nhau). */
export function orderErrorCategory(error: Pick<ApiError, "code" | "status">): OrderErrorCategory {
  switch (error.code) {
    case "OPTIMISTIC_LOCK":
      return "stale";
    case "LOCK_TIMEOUT":
    case "RATE_LIMITED":
      return "retry-later";
    case "IDEMPOTENT_REQUEST_IN_PROGRESS":
      return "in-progress";
    case "IDEMPOTENCY_KEY_REUSED":
      return "idempotency-misuse";
    case "VALIDATION_FAILED":
    case "UNSUPPORTED_PARAMETER":
    case "MALFORMED_REQUEST":
      return "validation";
    case "FORBIDDEN":
    case "OUT_OF_DATA_SCOPE":
      return "forbidden";
    case "NETWORK_ERROR":
      return "network";
  }
  if (ORDER_STALE_ERROR_CODES.includes(error.code)) return "stale";
  if (BUSINESS_RULE_CODES.includes(error.code)) return "business";
  if (error.status >= 500) return "retry-later";
  return "unknown";
}

/* ── Lỗi dùng chung ──────────────────────────────────────────────────── */

/**
 * Lỗi chung mọi thao tác: tranh chấp, idempotency, trạng thái đã đổi, quyền, không tìm thấy, mạng.
 * `null` → để hàm gọi xử lý tiếp (fallback chung).
 */
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
    case "IDEMPOTENT_REQUEST_IN_PROGRESS":
      return {
        title,
        detail:
          "Yêu cầu vừa gửi vẫn đang được máy chủ xử lý. Đợi vài giây, tải lại đơn để xem kết quả trước khi bấm lại.",
        traceId,
      };
    // 422 từ IdempotencyFilter: key đã gắn với một yêu cầu khác — yêu cầu này CHƯA được thực hiện
    case "IDEMPOTENCY_KEY_REUSED":
      return {
        title,
        detail:
          "Yêu cầu chưa được gửi đi do trùng mã với yêu cầu trước. Kiểm tra lại rồi bấm gửi lần nữa.",
        traceId,
      };
    // Trạng thái đơn đã đổi so với màn hình (bảng chuyển trạng thái BE, InvalidOrderTransitionException)
    case "ORDER_INVALID_TRANSITION":
    case "ORDER_CANCELLED":
      return { title, detail: ORDER_ERROR_MESSAGES[error.code], traceId };
    case "UNSUPPORTED_PARAMETER":
      return {
        title,
        detail: "Yêu cầu có giá trị không hợp lệ. Tải lại trang rồi thử lại.",
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

/** Mã lạ / 5xx: câu chung theo thao tác, giữ traceId — không hiện message tiếng Anh của máy chủ. */
function fallback(error: ApiError, title: string, action: string): OrderErrorView {
  return {
    title,
    detail: `Đã xảy ra lỗi khi ${action}. Vui lòng thử lại.`,
    traceId: error.traceId,
  };
}

/* ── Admin cancel ────────────────────────────────────────────────────── */

const CANCEL_FAILED = UI_LABELS.order.cancelFailedTitle;

/** BE `OrderController#adminCancel` → `Order#cancel` (thứ tự kiểm: body → 404 → phí → trạng thái → đã đóng gói). */
export function adminCancelErrorView(error: ApiError): OrderErrorView {
  const traceId = error.traceId;
  switch (error.code) {
    case "VALIDATION_FAILED":
      // BE: reasonCode thiếu, OTHER thiếu note, retainedPercent ngoài 0..100, agreedFee sai / đi kèm
      // retainedPercent, khoản thoả thuận vượt tổng đơn
      return {
        title: CANCEL_FAILED,
        detail:
          "Kiểm tra lại lý do huỷ, ghi chú (bắt buộc với lý do khác), tỷ lệ giữ lại hoặc khoản thoả thuận (chỉ chọn một).",
        traceId,
      };
    // BE BR-031 + BR-ORD-004 (Order#cancel → ORDER_NOT_CANCELLABLE): không còn cạnh → CANCELLED (kể cả
    // đơn ĐÃ huỷ / đã đóng sổ), hoặc đơn đã đóng gói (`packedAt`, kể cả đang ON_HOLD) — câu báo trung lập,
    // không đoán lý do. Nút lẽ ra đã ẩn qua allowedOrderActions; đây là lớp phòng hộ khi state đã cũ
    // (mã thuộc ORDER_STALE_ERROR_CODES → đóng dialog, tải lại đơn). CONFLICT giữ cho bản BE cũ.
    case "ORDER_NOT_CANCELLABLE":
    case "CONFLICT":
      return {
        title: "Đơn không còn huỷ được",
        detail: ORDER_ERROR_MESSAGES.ORDER_NOT_CANCELLABLE,
        rule: "BR-ORD-004",
        traceId,
      };
    // Quyết định 2026-10-17 (BR-ORD-004): chưa in thì hoàn đủ, không giữ phí / phần trăm nào
    case "CANCELLATION_FEE_BEFORE_PRINTING":
      return {
        title: CANCEL_FAILED,
        detail:
          "Chưa thể áp dụng phí huỷ trước khi bắt đầu in. Hãy bỏ thông tin phí huỷ và gửi lại yêu cầu huỷ đơn.",
        rule: "BR-ORD-004",
        traceId,
      };
    default:
      return (
        commonErrorView(error, CANCEL_FAILED, "huỷ đơn này") ??
        fallback(error, CANCEL_FAILED, "huỷ đơn")
      );
  }
}

/** BE `AdminCancelOrderRequest` (+ `CancellationFeeRequest`). `reason` cũ FE không gửi → rơi vào lỗi chung. */
export const ADMIN_CANCEL_FIELD_ERRORS = {
  reasonCode: { field: "reasonCode", message: "Chọn lý do huỷ hợp lệ." },
  note: {
    field: "note",
    message: `Ghi chú tối đa ${ORDER_LIMITS.cancelNoteMax} ký tự (bắt buộc với lý do khác).`,
  },
  retainedPercent: { field: "retainedPercent", message: "Tỷ lệ giữ lại phải từ 0 đến 100%." },
  agreedFee: {
    field: "agreedFee",
    message: "Khoản thoả thuận không hợp lệ (chỉ chọn tỷ lệ giữ lại HOẶC khoản thoả thuận).",
  },
  "agreedFee.amount": {
    field: "agreedFee.amount",
    message: "Khoản thoả thuận phải lớn hơn 0, là số nguyên đơn vị tiền và không vượt tổng đơn.",
  },
  "agreedFee.reason": {
    field: "agreedFee.reason",
    message: `Nhập lý do giữ khoản thoả thuận (tối đa ${ORDER_LIMITS.cancelFeeReasonMax} ký tự).`,
  },
  "agreedFee.detail": {
    field: "agreedFee.detail",
    message: `Nhập nội dung đã thoả thuận (tối đa ${ORDER_LIMITS.cancelFeeDetailMax} ký tự).`,
  },
} as const satisfies ServerFieldMap<
  | "reasonCode"
  | "note"
  | "retainedPercent"
  | "agreedFee"
  | "agreedFee.amount"
  | "agreedFee.reason"
  | "agreedFee.detail"
>;

/* ── Release (SCRUM-423) ─────────────────────────────────────────────── */

/** BE `ReleaseOrderRequest(@NotNull warehouseId)`. */
export const RELEASE_FIELD_ERRORS = {
  warehouseId: { field: "warehouseId", message: "Chọn kho xuất." },
} as const satisfies ServerFieldMap<"warehouseId">;

const RELEASE_REFUSED = UI_LABELS.order.releaseRefusedTitle;

/** Thứ tự kiểm ở BE: body → đơn → kho → mẫu duyệt → công nợ quá hạn → cọc → trạng thái (OrderReleaseService). */
export function releaseErrorView(error: ApiError): OrderErrorView {
  const traceId = error.traceId;
  const serverDetail = error.message || undefined;
  switch (error.code) {
    case "VALIDATION_FAILED":
      return { title: RELEASE_REFUSED, detail: "Chọn kho xuất trước khi release.", traceId };
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
    // docs 17 BR-02: chỉ release đơn Confirmed — BE `Order#release` → ORDER_INVALID_TRANSITION; state trên
    // màn có thể đã cũ. CONFLICT giữ cho bản BE cũ.
    case "ORDER_INVALID_TRANSITION":
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
    // BE Order#requireCreditHold / CreditHoldService#decide: không còn (hoặc chưa từng là) giữ công nợ
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

/* ── Giữ / gỡ giữ / giao thất bại / đóng phần còn lại (BE PR #133) ───── */

export type OrderStatusActionKey = "hold" | "resolveHold" | "deliveryFailure" | "remainderClosure";

const STATUS_ACTION_VERB: Record<OrderStatusActionKey, string> = {
  hold: "giữ đơn",
  resolveHold: "gỡ giữ đơn",
  deliveryFailure: "ghi giao thất bại",
  remainderClosure: "đóng phần còn lại của đơn",
};

function isOrderErrorCode(code: string): code is keyof typeof ORDER_ERROR_MESSAGES {
  return Object.hasOwn(ORDER_ERROR_MESSAGES, code);
}

/**
 * Message cho lỗi của bốn thao tác trạng thái đơn. Mã `ORDER_*` tra bảng `ORDER_ERROR_MESSAGES`
 * (riêng ORDER_BALANCE_NOT_PAID khi gỡ giữ: BE `resumeFromHold` — giữ vì thanh toán gỡ bằng tiền);
 * mã chung (tranh chấp / idempotency / quyền / 404 / mạng) theo ngữ cảnh thao tác.
 */
export function orderActionErrorView(
  error: ApiError,
  action: OrderStatusActionKey,
): OrderErrorView {
  const traceId = error.traceId;
  const title = ORDER_ACTION_LABELS[action].failedTitle;
  if (error.code === "ORDER_BALANCE_NOT_PAID" && action === "resolveHold") {
    return {
      title,
      detail:
        "Đơn chưa nhận đủ tiền theo phương thức thanh toán. Ghi nhận thanh toán trước rồi gỡ giữ.",
      traceId,
    };
  }
  if (isOrderErrorCode(error.code)) {
    return { title, detail: ORDER_ERROR_MESSAGES[error.code], traceId };
  }
  if (error.code === "VALIDATION_FAILED") {
    // BE trả fieldErrors tiếng Anh ("reasonCode is required"…) — không hiện thẳng.
    return {
      title,
      detail:
        action === "resolveHold"
          ? "Hãy ghi cách đã xử lý (bắt buộc)."
          : "Hãy chọn lý do; “Lý do khác” bắt buộc có ghi chú.",
      traceId,
    };
  }
  return (
    commonErrorView(error, title, "thực hiện thao tác này") ??
    fallback(error, title, STATUS_ACTION_VERB[action])
  );
}

/* ── Lệnh sản xuất của đơn ──────────────────────────────────────────── */

/**
 * `GET /production/orders` bị từ chối quyền: 403 FORBIDDEN (thiếu `production-orders:READ`, hoặc
 * quyền bị thu sau khi FE đã tải danh sách quyền) / OUT_OF_DATA_SCOPE. Báo "không có quyền xem",
 * không phải lỗi tải + Thử lại (bấm lại cũng không qua).
 */
export function isProductionForbidden(error: ApiError): boolean {
  return error.status === 403;
}
