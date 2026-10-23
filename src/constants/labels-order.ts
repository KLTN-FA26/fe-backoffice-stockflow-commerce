/**
 * Đơn hàng — giá trị wire BE (BE PR #133, SCRUM-239/246/247) + nhãn / thông báo tiếng Việt.
 *
 * `constants/` là tầng thấp nhất: không import gì ngoài chính nó. Mọi enum ở đây lấy nguyên văn từ BE
 * (`order/api/HoldReason`, `DeliveryFailureReason`, `CancellationReasonCode`, `OrderShipmentStatus`).
 */

import { ORDER_DELIVERY_MODE_UI } from "./labels-delivery-mode";

/* ── Lý do giữ đơn (BE HoldReason) ───────────────────────────────────── */

/** Mọi lý do một đơn có thể đang ON_HOLD (BE `HoldReason`). */
export const ORDER_HOLD_REASONS = [
  "CREDIT",
  "DESIGN_MISMATCH",
  "PAYMENT",
  "ADDRESS",
  "INVENTORY",
  "CUSTOMER",
  "FRAUD",
  "OTHER",
] as const;

/**
 * Lý do điều phối viên được tự nêu khi giữ đơn (`POST /orders/{id}/hold`,
 * `HoldReason#raisedByHand`). CREDIT và DESIGN_MISMATCH là của hệ thống — BE từ chối (400).
 */
export const ORDER_MANUAL_HOLD_REASONS = [
  "PAYMENT",
  "ADDRESS",
  "INVENTORY",
  "CUSTOMER",
  "FRAUD",
  "OTHER",
] as const;

export const ORDER_HOLD_REASON_LABELS = {
  CREDIT: "Vượt hạn mức công nợ",
  DESIGN_MISMATCH: "Sai lệch thiết kế khi đóng gói",
  PAYMENT: "Vấn đề thanh toán",
  ADDRESS: "Sai địa chỉ / hãng vận chuyển không giao tới",
  INVENTORY: "Thiếu hàng / lệch tồn kho",
  CUSTOMER: "Chờ khách xác nhận thay đổi",
  FRAUD: "Nghi ngờ gian lận",
  OTHER: "Lý do khác",
} as const satisfies Record<(typeof ORDER_HOLD_REASONS)[number], string>;

/**
 * Hướng dẫn thay cho nút "Gỡ giữ" khi đơn bị giữ bởi hệ thống — BE từ chối gỡ tay
 * (`ORDER_CREDIT_HOLD_USE_APPROVAL`, `ORDER_DESIGN_HOLD_USE_REVERIFICATION`).
 */
export const ORDER_HOLD_GUIDANCE = {
  CREDIT:
    "Đơn bị giữ vì vượt hạn mức công nợ — không gỡ giữ tại đây. Duyệt hoặc từ chối ở màn duyệt công nợ.",
  DESIGN_MISMATCH:
    "Đơn bị giữ vì thiết kế in lệch checksum lúc đóng gói — không gỡ giữ tại đây. Quản lý kho kiểm tra lại kiện ở bàn đóng gói.",
  UNRESOLVABLE: "Không xác định được lý do giữ — chưa thể gỡ giữ từ màn này. Tải lại trang.",
} as const;

/** Nhãn lý do giữ khách được đọc (`holdReasonPublic`) — chỉ dùng khi BE không trả `holdReason`. */
export const ORDER_HOLD_PUBLIC_LABELS: Readonly<Record<string, string>> = {
  AWAITING_CREDIT_APPROVAL: "Chờ duyệt hạn mức công nợ",
  UNDER_REVIEW: "Đang được xem xét",
};

/* ── Lý do giao thất bại (BE DeliveryFailureReason) ──────────────────── */

export const ORDER_DELIVERY_FAILURE_REASONS = [
  "CUSTOMER_ABSENT",
  "REFUSED",
  "WRONG_ADDRESS",
  "LOST",
  "DAMAGED",
  "OTHER",
] as const;

export const ORDER_DELIVERY_FAILURE_LABELS = {
  CUSTOMER_ABSENT: "Khách vắng mặt",
  REFUSED: "Khách từ chối nhận",
  WRONG_ADDRESS: "Sai địa chỉ",
  LOST: "Thất lạc hàng",
  DAMAGED: "Hàng hư hỏng",
  OTHER: "Lý do khác",
} as const satisfies Record<(typeof ORDER_DELIVERY_FAILURE_REASONS)[number], string>;

/* ── Lý do đóng phần còn lại (BE CancellationReasonCode) ─────────────── */

/**
 * `POST /orders/{id}/remainder-closure` nhận mọi `CancellationReasonCode`. Danh sách chọn chỉ giữ
 * lý do hợp với việc không giao nổi phần còn lại của đơn đã giao một phần; các mã còn lại
 * (PAYMENT_NOT_RECEIVED, PAYMENT_FAILED, CREDIT_REJECTED) thuộc huỷ trước khi giao.
 */
export const ORDER_REMAINDER_CLOSURE_REASONS = [
  "OUT_OF_STOCK",
  "PRODUCTION_ISSUE",
  "CUSTOMER_REQUEST",
  "DUPLICATE_ORDER",
  "SUSPECTED_FRAUD",
  "OTHER",
] as const;

export const ORDER_REMAINDER_CLOSURE_LABELS = {
  OUT_OF_STOCK: "Hết hàng, không cung cấp được",
  PRODUCTION_ISSUE: "Sự cố sản xuất",
  CUSTOMER_REQUEST: "Khách yêu cầu",
  DUPLICATE_ORDER: "Đơn trùng",
  SUSPECTED_FRAUD: "Nghi ngờ gian lận",
  OTHER: "Lý do khác",
} as const satisfies Record<(typeof ORDER_REMAINDER_CLOSURE_REASONS)[number], string>;

/* ── Lô giao (BE OrderShipmentStatus) ────────────────────────────────── */

export const ORDER_SHIPMENT_STATUSES = [
  "HANDED_OVER",
  "DELIVERED",
  "DELIVERY_FAILED",
  "RETURNED",
  // Giá trị BE thêm sau — hiển thị "Không rõ" thay vì làm hỏng cả trang chi tiết
  "UNKNOWN",
] as const;

/** Lô giao → chuỗi status của `StatusDot` (nhãn + màu dùng chung ở `lib/status-map.ts`). */
export const ORDER_SHIPMENT_STATUS_DISPLAY = {
  HANDED_OVER: "Handed Over",
  DELIVERED: "Delivered",
  DELIVERY_FAILED: "Delivery Failed",
  RETURNED: "Returned",
  UNKNOWN: "UNKNOWN",
} as const satisfies Record<(typeof ORDER_SHIPMENT_STATUSES)[number], string>;

/* ── Cách thu phần còn lại của đơn cọc (BE BalancePolicy / DepositBalancePolicy) ── */

/**
 * `Order.balancePolicy` và `CreditProfile.depositBalancePolicy` (BE PR #150): cách thu phần còn lại
 * của đơn cọc. ON_CREDIT = ghi thành công nợ khi giao, đến hạn sau `creditTermDays`; cần hồ sơ công nợ
 * `allowCredit` (409 BALANCE_POLICY_NOT_ALLOWED / 400 CREDIT_PROFILE_INVALID).
 */
export const ORDER_BALANCE_POLICIES = ["BEFORE_DELIVERY", "ON_DELIVERY", "ON_CREDIT"] as const;

export const ORDER_BALANCE_POLICY_LABELS = {
  BEFORE_DELIVERY: "Chuyển khoản trước khi giao",
  ON_DELIVERY: "Thu hộ khi giao hàng (COD)",
  ON_CREDIT: "Ghi công nợ phần còn lại",
} as const satisfies Record<(typeof ORDER_BALANCE_POLICIES)[number], string>;

/* ── Giao một phần (BE PR #150, PACK-PARTIAL) ────────────────────────── */

/**
 * Sales quyết đơn có được giao từng phần không (`PUT /orders/{id}/partial-shipment`); kho không còn
 * tự quyết. Mỗi quyết định được ghi vào lịch sử đơn.
 */
export const ORDER_PARTIAL_SHIPMENT_LABELS = {
  title: "Giao một phần",
  stateOn: "Đang cho phép",
  stateOff: "Chưa cho phép — đơn giao nguyên cả đơn",
  hintOn:
    "Kho được đóng và bàn giao từng phần của đơn; hàng có sẵn của đơn đang sản xuất được giao trước hàng in.",
  hintOff: "Kho phải đóng đủ cả đơn. Bật khi khách đồng ý nhận hàng từng phần.",
  allowButton: "Cho phép giao một phần",
  stopButton: "Dừng giao một phần",
  allowTitle: "Cho phép giao một phần",
  stopTitle: "Dừng giao một phần",
  allowDescription:
    "Kho được đóng và bàn giao từng phần của đơn. Quyết định được ghi vào lịch sử đơn.",
  stopDescription:
    "Đơn sẽ giao nguyên cả đơn; phần chưa giao của đơn đã giao dở sẽ đi trong một lần bàn giao. Quyết định được ghi vào lịch sử đơn.",
  noteLabel: "Ghi chú (không bắt buộc)",
  notePlaceholder: "Vd: Khách đồng ý nhận hàng sẵn trước, hàng in giao sau",
  allowSubmit: "Cho phép",
  stopSubmit: "Dừng giao một phần",
  allowSuccess: "Đã cho phép giao một phần",
  stopSuccess: "Đã dừng giao một phần",
  failedTitle: "Không cập nhật được giao một phần",
  /** Đơn đã giao dở vì hàng in chưa xong: BE khoá không cho tắt (ORDER_PARTIAL_SHIPMENT_LOCKED). */
  lockedAwaitingPrints:
    "Hàng có sẵn đã đi trước hàng in nên đơn đã tách — chưa dừng giao một phần được cho tới khi hàng in giao xong hoặc phần còn lại được đóng.",
  /** Đơn đã đi / đã đóng: không còn đổi được. */
  lockedClosed: "Đơn đã giao đi hoặc đã đóng — không còn đổi được cách giao.",
} as const;

/* ── Lịch sử đơn (BE GET /orders/{id}/history) ───────────────────────── */

/** BE `OrderStatusChangeResponse.type`. */
export const ORDER_HISTORY_ENTRY_TYPES = [
  "STATUS_CHANGE",
  "PARTIAL_SHIPMENT_DECISION",
  "DELIVERY_MODE_CHANGE",
] as const;

export const ORDER_HISTORY_LABELS = {
  title: "Lịch sử đơn",
  loading: "Đang tải lịch sử…",
  empty: "Chưa có thay đổi nào được ghi lại",
  loadFailed: "Không tải được lịch sử đơn. Hãy thử tải lại trang.",
  retry: "Tải lại",
  placed: "Đặt đơn",
  partialAllowed: "Bật giao một phần",
  partialStopped: "Tắt giao một phần",
  unknownEntry: "Thay đổi không rõ",
  by: "Bởi",
  noteLabel: "Ghi chú",
  statusMoved: "Chuyển trạng thái",
} as const;

/* ── Đóng phần còn lại kèm phí thoả thuận (BE PR #150) ───────────────── */

export const ORDER_REMAINDER_FEE_LABELS = {
  toggle: "Giữ một khoản phí đã thoả thuận với khách",
  toggleHint:
    "Chỉ khi hàng in đã bắt đầu in. Tiền khách đã trả vượt giá trị đơn mới trả phí này trước (kể cả tiền cọc), phần dư được hoàn; thiếu thì ghi thành khoản phải thu. Tối đa bằng giá trị phần hàng in bị đóng.",
  amount: "Số tiền phí (VND)",
  reason: "Lý do giữ phí",
  detail: "Chi tiết đã thoả thuận với khách",
  amountInvalid: "Nhập số tiền nguyên lớn hơn 0",
  /** Số đã đọc được từ ô nhập — để người dùng soát lại trước khi gửi. */
  amountPreview: (formatted: string) => `Sẽ ghi nhận: ${formatted}`,
  reasonRequired: "Nhập lý do giữ phí",
  detailRequired: "Nhập chi tiết đã thoả thuận",
  reasonTooLong: "Lý do tối đa 500 ký tự",
  detailTooLong: "Chi tiết tối đa 2000 ký tự",
} as const;

/* ── Nhãn UI thao tác trạng thái ─────────────────────────────────────── */

export const ORDER_ACTION_LABELS = {
  hold: {
    button: "Giữ đơn",
    title: "Giữ đơn hàng",
    description:
      "Tạm dừng xử lý đơn này. Đơn quay lại đúng bước đang làm khi gỡ giữ. Hàng đã giữ chỗ vẫn được giữ.",
    reasonLabel: "Lý do giữ",
    noteLabel: "Ghi chú",
    submit: "Giữ đơn",
    success: "Đã giữ đơn hàng",
    failedTitle: "Không giữ được đơn",
  },
  resolveHold: {
    button: "Gỡ giữ",
    title: "Gỡ giữ đơn hàng",
    description: "Ghi lại cách đã xử lý — đơn quay lại bước trước khi bị giữ.",
    noteLabel: "Cách đã xử lý",
    submit: "Gỡ giữ",
    success: "Đã gỡ giữ đơn hàng",
    failedTitle: "Không gỡ giữ được đơn",
  },
  deliveryFailure: {
    button: "Ghi giao thất bại",
    title: "Ghi nhận giao thất bại",
    description: "Hãng vận chuyển báo không giao được đơn này.",
    reasonLabel: "Lý do giao thất bại",
    noteLabel: "Ghi chú",
    submit: "Ghi giao thất bại",
    success: "Đã ghi nhận giao thất bại",
    failedTitle: "Không ghi được giao thất bại",
  },
  remainderClosure: {
    button: "Đóng phần còn lại",
    title: "Đóng phần còn lại của đơn",
    description:
      "Số lượng chưa giao sẽ không được giao nữa. Đơn chuyển theo kết quả các lô giao, và tiền đã nhận vượt giá trị hàng đã giao sẽ được tạo yêu cầu hoàn.",
    reasonLabel: "Lý do đóng",
    noteLabel: "Ghi chú",
    submit: "Đóng phần còn lại",
    success: "Đã đóng phần còn lại của đơn",
    failedTitle: "Không đóng được phần còn lại",
  },
  reasonPlaceholder: "Chọn lý do",
  requiredNoteHint: "Bắt buộc ghi chú khi chọn “Lý do khác”.",
  /** Giải thích vì sao không có nút "Ghi giao thất bại" khi đơn đã chia lô. */
  shipmentsHint: "Đơn đã chia lô giao — kết quả giao được ghi theo từng lô, không ghi ở cấp đơn.",
} as const;

/* ── Thông báo lỗi theo mã BE ────────────────────────────────────────── */

/**
 * Mã lỗi nghiệp vụ đơn hàng của BE (`common/error/ErrorCode.java`, PR #133) → câu tiếng Việt.
 * Branch theo `error.code`, KHÔNG theo `message` (tiếng Anh, có thể đổi).
 */
export const ORDER_ERROR_MESSAGES = {
  ORDER_INVALID_TRANSITION:
    "Đơn hàng không thể chuyển sang trạng thái này lúc này — trạng thái đơn đã đổi. Dữ liệu đã được tải lại.",
  ORDER_NOT_ON_HOLD: "Đơn hàng không ở trạng thái tạm giữ. Dữ liệu đã được tải lại.",
  ORDER_CREDIT_HOLD_USE_APPROVAL: ORDER_HOLD_GUIDANCE.CREDIT,
  ORDER_DESIGN_HOLD_USE_REVERIFICATION: ORDER_HOLD_GUIDANCE.DESIGN_MISMATCH,
  ORDER_DELIVERY_VIA_SHIPMENT: ORDER_ACTION_LABELS.shipmentsHint,
  ORDER_BALANCE_NOT_PAID: "Đơn hàng phải được thanh toán đủ trước khi xuất hàng.",
  ORDER_SHIPMENT_NOT_FOUND: "Đơn hàng không có lô giao này.",
  ORDER_SHIPMENT_CONFLICT: "Lô giao này đã được bàn giao cùng hàng khác.",
  ORDER_SHIPMENT_QUANTITY_EXCEEDED: "Vượt quá số lượng còn lại cần giao của dòng đơn.",
  ORDER_SHIPMENT_INVALID_TRANSITION: "Lô giao không thể chuyển sang trạng thái này lúc này.",
  ORDER_NOT_CANCELLABLE:
    "Đơn hàng không thể huỷ nữa — hàng đã đóng gói, hãy xử lý qua luồng trả hàng.",
  ORDER_CANCELLED: "Đơn hàng đã bị huỷ.",
  // BE PR #150 — giao một phần do Sales quyết trên đơn
  ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED:
    "Đơn chưa được phép giao một phần — nhờ Sale bật “Cho phép giao một phần” trên đơn.",
  ORDER_PARTIAL_SHIPMENT_LOCKED:
    "Không đổi được cách giao nữa: đơn đã giao đi hoặc đóng, hoặc hàng có sẵn đã đi trước hàng in nên đơn đã tách.",
  // BE PR #150 — thu phần còn lại ghi công nợ; huỷ / đóng phần còn lại có phí
  BALANCE_CREDIT_LIMIT_EXCEEDED:
    "Phần còn lại ghi công nợ làm công nợ của khách vượt hạn mức. Chọn cách thu khác hoặc nhờ Kế toán nâng hạn mức.",
  CUSTOMER_CREDIT_OVERDUE:
    "Khách đang có công nợ quá hạn — chưa ghi công nợ thêm được. Chọn cách thu khác hoặc xử lý khoản quá hạn trước.",
  BALANCE_POLICY_NOT_ALLOWED:
    "Khách này chưa được phép ghi công nợ phần còn lại — chọn cách thu khác hoặc bật công nợ cho khách.",
  CREDIT_PROFILE_INVALID:
    "Điều khoản của khách chưa hợp lệ: “Ghi công nợ phần còn lại” cần bật công nợ (allowCredit) cùng hạn mức và số ngày nợ.",
  CANCELLATION_FEE_BEFORE_PRINTING:
    "Đơn chưa bắt đầu in nên hoàn tiền đủ, không giữ phí — bỏ khoản phí rồi gửi lại.",
  // BE PR #157 — hình thức giao (LP-1, LP-2)
  DELIVERY_MODE_LOCKED: ORDER_DELIVERY_MODE_UI.lockedError,
  DELIVERY_MODE_FTL_NO_COD: ORDER_DELIVERY_MODE_UI.ftlNoCod,
  // Release đơn (BE `OrderReleaseService`)
  WAREHOUSE_NOT_FOUND: "Không tìm thấy kho đã chọn. Chọn lại kho.",
  WAREHOUSE_INACTIVE: "Kho đã chọn không còn hoạt động. Chọn kho khác.",
  DESIGN_SAMPLE_NOT_APPROVED:
    "Đơn có thiết kế mới chưa có mẫu thử khách đã duyệt — chưa release được (BR-PRD-08).",
  ORDER_DEPOSIT_NOT_RECEIVED: "Tiền cọc của đơn chưa về — chưa release được (BR-PRD-09).",
} as const;

export type OrderErrorCode = keyof typeof ORDER_ERROR_MESSAGES;
