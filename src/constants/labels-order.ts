/**
 * Đơn hàng — giá trị wire BE (BE PR #133, SCRUM-239/246/247) + nhãn / thông báo tiếng Việt.
 *
 * `constants/` là tầng thấp nhất: không import gì ngoài chính nó. Mọi enum ở đây lấy nguyên văn từ BE
 * (`order/api/HoldReason`, `DeliveryFailureReason`, `CancellationReasonCode`, `OrderShipmentStatus`).
 */

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
    "Đơn bị giữ vì thiết kế in lệch checksum lúc đóng gói — không gỡ giữ tại đây. QC hoặc quản lý kho kiểm tra lại kiện ở bàn đóng gói.",
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
] as const;

/** Trạng thái lô sau khi đọc: giá trị BE thêm sau → "UNKNOWN" (hiển thị "Không rõ"). */
export const ORDER_SHIPMENT_READ_STATUSES = [...ORDER_SHIPMENT_STATUSES, "UNKNOWN"] as const;

/** Lô giao → chuỗi status của `StatusDot` (nhãn + màu dùng chung ở `lib/status-map.ts`). */
export const ORDER_SHIPMENT_STATUS_DISPLAY = {
  HANDED_OVER: "Handed Over",
  DELIVERED: "Delivered",
  DELIVERY_FAILED: "Delivery Failed",
  RETURNED: "Returned",
  UNKNOWN: "UNKNOWN",
} as const satisfies Record<(typeof ORDER_SHIPMENT_READ_STATUSES)[number], string>;

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
  // BE trả cùng mã cho đơn đã huỷ / đã đóng sổ / đã đóng gói hoặc qua bước không còn cạnh → CANCELLED
  // (Order#cancel, requireNotPacked) — không được đoán là "đã đóng gói".
  ORDER_NOT_CANCELLABLE:
    "Không thể huỷ đơn ở trạng thái hiện tại — đơn có thể đã được huỷ, đã đóng gói hoặc đã sang bước không cho huỷ.",
  ORDER_CANCELLED: "Đơn hàng đã bị huỷ.",
} as const;

export type OrderErrorCode = keyof typeof ORDER_ERROR_MESSAGES;
