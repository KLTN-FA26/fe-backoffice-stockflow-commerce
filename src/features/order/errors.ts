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
  // BE PR #150: đơn đã đi / đóng (hoặc đã tách vì hàng có sẵn đi trước hàng in) — tải lại để thấy trạng thái thật
  "ORDER_PARTIAL_SHIPMENT_LOCKED",
  // BE PR #157: hình thức giao đã khoá (kho bắt đầu đóng gói / đơn qua đóng gói) — tải lại để thấy trạng thái thật
  "DELIVERY_MODE_LOCKED",
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

// Release (SCRUM-423): lý do từ chối + lỗi theo ô ở `release-errors.ts` (PR #74).

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

/** Động từ cho câu lỗi chung / dự phòng của từng thao tác ("Bạn không có quyền …", "Đã xảy ra lỗi khi …"). */
const STATUS_ACTION_VERB: Readonly<Record<OrderStatusActionKey, string>> = {
  hold: "giữ đơn",
  resolveHold: "gỡ giữ đơn",
  deliveryFailure: "ghi giao thất bại",
  remainderClosure: "đóng phần còn lại của đơn",
  partialShipment: "đổi cách giao một phần",
  release: "release đơn",
  deliveryMode: "đổi hình thức giao",
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
  const title = FAILED_TITLES[action];
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
    return { title, detail: VALIDATION_DETAIL[action], traceId };
  }
  // Release / đổi hình thức: 403 khi chọn hình thức khác của đơn mà thiếu `sales-order-delivery-modes:UPDATE`
  // (BE PR #157)
  if (error.code === "FORBIDDEN" && (action === "release" || action === "deliveryMode")) {
    return { title, detail: ORDER_DELIVERY_MODE_UI.forbidden, traceId };
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
