/**
 * Giữ hoàn tất đơn (WF-05 GH-2) — BE `OrderCompletionHoldController` / `OrderCompletionHolds`.
 *
 * Sale tạm dừng việc hệ thống tự hoàn tất đơn (chạy đêm) trong lúc xác minh một lần giao với hãng. Đơn GIỮ NGUYÊN trạng
 * thái và các lô khác vẫn chạy — khác "Giữ đơn" (ON_HOLD, docs 17 §4.9). Mỗi đơn có tối đa một lần giữ đang mở; gỡ giữ
 * phải ghi kết quả xác minh. Enum lấy nguyên văn từ BE `CompletionHoldReason`.
 */

/** BE `CompletionHoldReason`. */
export const COMPLETION_HOLD_REASONS = ["DELIVERY_DISPUTED", "OTHER"] as const;

export const COMPLETION_HOLD_REASON_LABELS = {
  DELIVERY_DISPUTED: "Khách khiếu nại giao hàng",
  OTHER: "Lý do khác",
  UNKNOWN: "Không rõ",
} as const satisfies Record<(typeof COMPLETION_HOLD_REASONS)[number] | "UNKNOWN", string>;

/** Giới hạn ô nhập — BE `CompletionHoldRequest` / `ReleaseCompletionHoldRequest` (`@Size(max = 1000)`). */
export const COMPLETION_HOLD_LIMITS = { noteMax: 1000 } as const;

export const COMPLETION_HOLD_LABELS = {
  card: {
    title: "Giữ hoàn tất",
    failed: "Không tải được tình trạng giữ hoàn tất của đơn.",
    held: "Đang giữ hoàn tất",
    heldHint:
      "Hệ thống sẽ không tự hoàn tất đơn cho tới khi gỡ giữ. Trạng thái đơn và các lô giao khác không bị ảnh hưởng.",
    notHeld:
      "Đơn không bị giữ hoàn tất. Giữ khi cần xác minh một lần giao với hãng trước khi đơn tự hoàn tất.",
    reason: "Lý do",
    note: "Ghi chú",
    heldAt: "Giữ lúc",
    heldBy: "Người giữ",
    releasedAt: "Gỡ lúc",
    releasedBy: "Người gỡ",
  },
  hold: {
    button: "Giữ hoàn tất",
    title: "Giữ hoàn tất đơn",
    description: (orderNumber: string) =>
      `Đơn ${orderNumber} giữ nguyên trạng thái; chỉ việc tự hoàn tất hằng đêm bị tạm dừng cho tới khi gỡ giữ.`,
    reason: "Lý do giữ",
    reasonPlaceholder: "Chọn lý do",
    note: "Ghi chú",
    noteHintOther: "Bắt buộc khi chọn “Lý do khác”.",
    notePlaceholder: "VD: Khách báo chưa nhận được thùng nào, đang xác minh với hãng",
    submit: "Giữ hoàn tất",
    success: "Đã giữ hoàn tất đơn",
    failedTitle: "Không giữ hoàn tất được",
  },
  release: {
    button: "Gỡ giữ",
    title: "Gỡ giữ hoàn tất",
    description: (orderNumber: string) =>
      `Ghi lại kết quả xác minh. Lần chạy đêm kế tiếp sẽ hoàn tất đơn ${orderNumber} nếu mọi điều kiện khác đã đủ.`,
    note: "Kết quả xác minh",
    notePlaceholder: "VD: Hãng xác nhận đã giao, khách đã nhận đủ hàng",
    submit: "Gỡ giữ",
    success: "Đã gỡ giữ hoàn tất",
    failedTitle: "Không gỡ giữ hoàn tất được",
  },
  validation: {
    reasonRequired: "Chọn lý do giữ.",
    noteRequiredForOther: "Nhập ghi chú khi chọn “Lý do khác”.",
    noteRequired: "Nhập kết quả xác minh.",
    noteTooLong: "Ghi chú tối đa 1000 ký tự.",
  },
} as const;

/** Mã lỗi BE của giữ hoàn tất (`ErrorCode.java`, WF-05 GH-2) → câu tiếng Việt. */
export const COMPLETION_HOLD_ERROR_MESSAGES = {
  ORDER_COMPLETION_ALREADY_HELD:
    "Đơn đang được giữ hoàn tất rồi (có thể người khác vừa giữ). Dữ liệu đã được tải lại.",
  ORDER_COMPLETION_HOLD_NOT_APPLICABLE:
    "Đơn đã hoàn tất, đã đóng, đã huỷ, đã trả hoặc đã hoàn tiền — không còn gì để giữ. Dữ liệu đã được tải lại.",
  ORDER_COMPLETION_NOT_HELD:
    "Đơn không còn bị giữ hoàn tất (có thể người khác vừa gỡ). Dữ liệu đã được tải lại.",
} as const;
