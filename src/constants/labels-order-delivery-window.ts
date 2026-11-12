/**
 * Lịch giao của đơn + dời cửa sổ giao (docs 17 §4.5, §5.5, BR-28, BR-29; BE `DeliveryBatchController`). Trạng thái
 * hiển thị của đợt do hệ thống tính (§5.5) — FE chỉ hiện, không ai chuyển tay.
 */

/** BE `DeliveryBatchService.BatchState` → nhãn Việt kèm mã nguyên văn docs §5.5. */
export const DELIVERY_BATCH_STATE_LABELS = {
  AWAITING_STOCK: "Chờ hàng",
  READY: "Sẵn sàng",
  IN_DELIVERY: "Đang giao",
  DELIVERED: "Đã giao",
  CLOSED: "Đã đóng",
  UNKNOWN: "Không rõ",
} as const;

/** Mã `Awaiting Stock` … của docs §5.5 (hiện trong tooltip để đối chiếu docs). */
export const DELIVERY_BATCH_STATE_CODES = {
  AWAITING_STOCK: "Awaiting Stock",
  READY: "Ready",
  IN_DELIVERY: "In Delivery",
  DELIVERED: "Delivered",
  CLOSED: "Closed",
  UNKNOWN: "Unknown",
} as const;

/** BE `WindowChangeReason` (docs 17 BR-28). */
export const WINDOW_CHANGE_REASONS = ["CUSTOMER_REQUEST", "SELLER_DELAY"] as const;
export const WINDOW_CHANGE_REASON_LABELS = {
  CUSTOMER_REQUEST: "Khách xin dời / đồng ý nhận sớm",
  SELLER_DELAY: "Bên bán giao trễ (ví dụ sản xuất trễ)",
} as const;

export const DELIVERY_SCHEDULE_LABELS = {
  title: "Lịch giao",
  loading: "Đang tải lịch giao…",
  failed: "Không tải được lịch giao của đơn.",
  contract: (contractNumber: string) => `Hợp đồng ${contractNumber}`,
  batch: (seq: number) => `Đợt ${seq}`,
  window: "Cửa sổ giao",
  contractWindow: (range: string) => `Theo hợp đồng: ${range}`,
  moved: "Đã dời",
  late: "Trễ",
  lateHint: "Đã qua ngày kết thúc cửa sổ giao mà chưa bàn giao hết (DELIVERY_LATE, docs 17 §4.12).",
  released: (when: string) => `Đã release ${when}`,
  notReleased: "Chưa release",
  cartonsHeader: "Thùng theo SKU",
  cartons: (held: number, total: number) => `${held}/${total} thùng đã giữ`,
  noLines: "Đợt không có dòng hàng.",
  lockedHint: "Đợt đã có thùng bàn giao (hoặc đã đóng) — cửa sổ giao không dời được (BR-28).",
  history: "Lịch sử dời cửa sổ",
  historyEntry: (oldRange: string, newRange: string) => `${oldRange} → ${newRange}`,
  evidenceMessage: (id: string) => `Tin nhắn chat của khách (${id})`,
  evidenceFile: (name: string) => `Tệp: ${name}`,
  changedAt: (when: string) => `lúc ${when}`,
  /** Ghi chú cuối panel — để người đọc biết vì sao nút bị ẩn khi thiếu quyền. */
  readOnly: "Chỉ Sale (sales-contracts:UPDATE) mới dời được cửa sổ giao.",
} as const;

export const WINDOW_CHANGE_LABELS = {
  button: "Dời cửa sổ giao",
  title: "Dời cửa sổ giao",
  description: (seq: number, orderNumber: string) =>
    `Dời cửa sổ giao của đợt ${seq} (đơn ${orderNumber}). Hợp đồng đã ký giữ nguyên; lịch giao hiệu lực của khách đổi theo. Không đổi SKU, số thùng, số đợt.`,
  submit: "Dời cửa sổ giao",
  success: "Đã dời cửa sổ giao",
  failedTitle: "Không dời được cửa sổ giao",
  startLabel: "Từ ngày",
  endLabel: "Đến ngày",
  reasonLabel: "Lý do",
  reasonPlaceholder: "Chọn lý do",
  noteLabel: "Ghi chú",
  notePlaceholder: "Ví dụ: khách đồng ý nhận sớm trong chat ngày…",
  evidenceLabel: "Bằng chứng khách đồng ý",
  evidenceMessageLabel: "Mã tin nhắn của khách trong chat",
  evidenceMessageHint:
    "Tin nhắn do chính khách gửi, trong cuộc chat của khách (về đơn này hoặc chưa gắn đơn) — tin của nhân viên hoặc của khách khác không được nhận (BR-28).",
  evidenceMessagePlaceholder: "Dán mã tin nhắn (UUID)",
  /** Lỗi kiểm ở FE trước khi gửi — cùng điều kiện BE kiểm (BR-28). */
  startRequired: "Chọn ngày bắt đầu cửa sổ mới",
  endRequired: "Chọn ngày kết thúc cửa sổ mới",
  endBeforeStart: "Ngày kết thúc không được trước ngày bắt đầu",
  startInPast: "Cửa sổ mới không được bắt đầu ở quá khứ",
  reasonRequired: "Chọn mã lý do",
  noteRequired: "Ghi chú là bắt buộc",
  noteTooLong: "Ghi chú tối đa 1000 ký tự",
  evidenceRequired: "Nhập mã tin nhắn chat làm bằng chứng khách đồng ý",
  evidenceInvalid: "Mã tin nhắn phải là UUID hợp lệ",
  /** Thứ tự các đợt (BR-28): đợt sau không bắt đầu sớm hơn đợt trước. */
  orderViolation: (seq: number) =>
    `Đợt ${seq} sẽ bắt đầu trước đợt đứng trước nó — hãy dời cả các đợt sau (BR-28).`,
  previousWindowHint: (range: string) => `Cửa sổ hiện hành: ${range}`,
  /** Lý do BE từ chối — câu Việt + mã quy tắc. */
  locked:
    "Đợt này đã có thùng bàn giao nên cửa sổ giao không dời được nữa. Dữ liệu đã được tải lại.",
  lockedRule: "BR-28",
  batchNotFound: "Đợt giao không còn thuộc đơn này. Dữ liệu đã được tải lại.",
  orderClosed:
    "Đơn đã huỷ, đã đóng hoặc đã hoàn tất nên lịch giao không dời được nữa. Dữ liệu đã được tải lại.",
  /** 400 VALIDATION_FAILED: BE dùng một mã cho mọi điều kiện — liệt kê để người dùng tự kiểm. */
  validation:
    "Kiểm tra lại: cửa sổ mới không bắt đầu ở quá khứ và không trước đợt đứng trước (cần thì dời cả các đợt sau); ghi chú bắt buộc; bằng chứng phải là tin nhắn do chính khách gửi trong chat của khách (đơn này hoặc chưa gắn đơn).",
  validationRule: "BR-28",
} as const;
