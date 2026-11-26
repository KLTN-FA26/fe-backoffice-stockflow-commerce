/**
 * Lô hàng hoàn về (WF-05 GH-1; docs 09 §4.3, 17 §4.8) — BE `DeliveryFailureController` / `DeliveryFailureService`.
 *
 * Từ BE PR #377 không còn "giao lại" trên đơn cũ (gửi lại = đơn mới, quyết định Q-12): hãng mang lô về, Quản lý kho ghi
 * "hàng hoàn về" (cần APPROVE, Q-7), kho lập và xác nhận phiếu nhận hàng hoàn → BE mở hồ sơ và đóng ngay
 * (`closure = RECORDED_ON_RETURN`), lúc xác nhận phiếu mới tính tiền. Màn này vì vậy là LỊCH SỬ chỉ đọc. Hồ sơ `OPEN` /
 * `REDELIVERY` chỉ còn ở đơn cũ trước #377 (Q-13): Sale chỉ còn "Huỷ phần chưa giao" khi đơn cũ đang giữ vì giao thất bại.
 * Enum lấy nguyên văn từ BE `DeliveryFailureCase.Status`.
 */

/** BE `DeliveryFailureCase.Status` (REDELIVERY / REDELIVERED chỉ còn ở hồ sơ cũ). */
export const DELIVERY_FAILURE_CASE_STATUSES = [
  "OPEN",
  "REDELIVERY",
  "REDELIVERED",
  "CANCELLED",
] as const;

/** Hồ sơ chưa đóng (BE `Status#isClosed` = false): đơn cũ còn huỷ phần chưa giao được. */
export const DELIVERY_FAILURE_UNDECIDED_STATUSES = ["OPEN", "REDELIVERY"] as const;

/** BE `DeliveryFailureCaseResponse.closure` (contract F-4): ai đóng hồ sơ CANCELLED. */
export const DELIVERY_FAILURE_CLOSURES = ["RECORDED_ON_RETURN", "CANCELLED_BY_SALES"] as const;

/** Trạng thái hồ sơ → chuỗi status sẵn có của `StatusDot` (chỉ để lấy tone); nhãn Việt ở `statusLabels`. */
export const DELIVERY_FAILURE_CASE_STATUS_DISPLAY = {
  OPEN: "On Hold",
  REDELIVERY: "In Progress",
  REDELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RECORDED_ON_RETURN: "Returned",
  UNKNOWN: "UNKNOWN",
} as const;

/** Giới hạn ô nhập — BE `DeliveryFailureCaseRequests` / `CancellationFeeRequest`. */
export const DELIVERY_FAILURE_LIMITS = {
  noteMax: 1000,
  feeReasonMax: 500,
  feeDetailMax: 2000,
  /** BE `GET /orders/delivery-failures?limit` — mặc định 50, tối đa 200. */
  listLimit: 200,
} as const;

export const DELIVERY_FAILURE_LABELS = {
  /** Mục menu + tiêu đề (ẩn) của trang. */
  title: "Lô hàng hoàn về",
  subtitle:
    "Lịch sử các lô hãng mang về và kho đã nhận lại trên phiếu nhận hàng hoàn. Tiền của lô được tính khi Quản lý kho xác nhận phiếu; muốn gửi lại hàng thì tạo đơn mới.",
  statusLabels: {
    OPEN: "Chờ xử lý (đơn cũ)",
    REDELIVERY: "Đang giao lại (đơn cũ)",
    REDELIVERED: "Đã giao lại (đơn cũ)",
    /** CANCELLED khi BE chưa trả `closure` (BE cũ) — không đoán ai đóng. */
    CANCELLED: "Đã đóng",
    UNKNOWN: "Không rõ",
  },
  /** CANCELLED theo `closure` (F-4). */
  closureLabels: {
    RECORDED_ON_RETURN: "Đã ghi nhận hàng hoàn về",
    CANCELLED_BY_SALES: "Đã huỷ phần chưa giao",
  },
  columns: {
    order: "Đơn hàng",
    receipt: "Phiếu nhận hàng hoàn",
    reason: "Lý do giao thất bại",
    openedAt: "Nhận về lúc",
    status: "Trạng thái",
    actions: "Thao tác",
  },
  emptyAll: {
    title: "Chưa có lô hàng hoàn về",
    description: "Chưa có lô nào bị hãng mang về và được kho nhận lại.",
  },
  loadFailed: "Không tải được danh sách lô hàng hoàn về.",
  caption: (shown: number) => `${shown} hồ sơ, mới nhất trước`,
  /** Máy chủ trả tối đa `listLimit` hồ sơ, cũ nhất trước — chạm trần thì các hồ sơ mới nhất có thể bị thiếu. */
  truncated: (limit: number) =>
    `Đang hiện ${limit} hồ sơ đầu tiên máy chủ trả về; hồ sơ mới hơn có thể chưa hiện. Mở chi tiết đơn để xem hồ sơ của một đơn.`,
  /** Khối "Lô hàng hoàn về" trong chi tiết đơn. */
  section: {
    title: "Lô hàng hoàn về",
    loading: "Đang tải hồ sơ hàng hoàn về…",
    failed: "Không tải được hồ sơ hàng hoàn về của đơn.",
    none: "Đơn chưa có lô nào được kho nhận lại.",
    /** Đơn cũ (trước #377) giữ vì giao thất bại, lô về chưa có hồ sơ. */
    uncased:
      "Đơn cũ đang giữ vì giao thất bại: có lô hãng đã mang về nhưng kho chưa lập phiếu nhận hàng hoàn. Có thể huỷ phần chưa giao ngay mà không chờ hàng về.",
    /** Đơn cũ còn hồ sơ chưa đóng. */
    legacy:
      "Đơn cũ (trước khi bỏ “Giao lại”): không giao lại trên đơn này nữa. Huỷ phần chưa giao để tính tiền; muốn gửi lại hàng thì tạo đơn mới.",
    receipt: (number: string) => `Phiếu ${number}`,
    openedAt: (when: string) => `Nhận về lúc ${when}`,
    decidedAt: (when: string) => `Quyết định lúc ${when}`,
    decisionNote: "Ghi chú quyết định",
    failureNote: "Ghi chú của hãng / kho",
    failedTripFee: "Phí chuyến giao hỏng (đơn cũ)",
    carrierClaim: "Không thu khách — đòi hãng vận chuyển",
    readyForRelease: "Đã giữ đủ hàng — chờ Quản lý kho ra lệnh xuất kho để giao lại",
    units: (units: number, held: number) => `${units} sp về kho · đã giữ lại ${held}`,
    cartons: (count: number) => `${count} thùng`,
  },
  cancel: {
    button: "Huỷ phần chưa giao",
    title: "Huỷ phần chưa giao",
    description: (orderNumber: string) =>
      `Phần chưa giao của đơn ${orderNumber} bị đóng cùng mọi hồ sơ chưa quyết; tiền đã thu vượt phần đã giao và phí thoả thuận thành số phải hoàn. Không hoàn tác được.`,
    descriptionWithoutCase: (orderNumber: string) =>
      `Kho chưa nhận lại hàng nhưng khách không chờ: phần chưa giao của đơn ${orderNumber} bị đóng ngay. Hàng về sau sẽ mở hồ sơ đã huỷ. Không hoàn tác được.`,
    note: "Lý do huỷ",
    notePlaceholder: "VD: Khách không nhận lại hàng; hai bên thống nhất huỷ phần chưa giao",
    feeToggle: "Giữ phí thoả thuận cho hàng đã sản xuất",
    feeHint:
      "Hàng in theo thiết kế của khách mặc định không hoàn tiền. Tiền đã thu trả phí trước; phần thiếu ghi thành khoản phải thu.",
    feeAmount: "Số tiền thoả thuận (VND)",
    feeReason: "Lý do giữ phí",
    feeDetail: "Nội dung đã thoả thuận",
    submit: "Huỷ phần chưa giao",
    success: "Đã huỷ phần chưa giao của đơn",
    failedTitle: "Không huỷ được phần chưa giao",
  },
  validation: {
    noteRequired: "Nhập ghi chú quyết định.",
    noteTooLong: `Ghi chú tối đa 1000 ký tự.`,
    feeInvalid: "Phí phải là số nguyên VND lớn hơn 0.",
    feeReasonRequired: "Nhập lý do giữ phí (tối đa 500 ký tự).",
    feeDetailRequired: "Nhập nội dung đã thoả thuận (tối đa 2000 ký tự).",
  },
} as const;

/**
 * Mã lỗi BE của giao thất bại + sửa kết quả giao (`ErrorCode.java`, WF-05) → câu tiếng Việt. Thêm ở đây (không ở
 * `ORDER_ERROR_MESSAGES`) để màn trả hàng / hoá đơn chạy song song không đụng cùng bảng.
 */
export const DELIVERY_FAILURE_ERROR_MESSAGES = {
  DELIVERY_FAILURE_CASE_NOT_FOUND:
    "Không tìm thấy hồ sơ giao thất bại này trên đơn. Dữ liệu đã được tải lại.",
  DELIVERY_FAILURE_INVALID_TRANSITION:
    "Hồ sơ không còn ở bước này (đã được quyết định, hoặc hàng giao lại đã được lấy). Dữ liệu đã được tải lại.",
  DELIVERY_FAILURE_REST_NOT_CLOSABLE:
    "Chưa huỷ được phần chưa giao: đơn đang bị giữ vì lý do khác hoặc còn hàng đã đóng gói chưa rời kho. Gỡ giữ / chờ hàng đi trước.",
  ORDER_DELIVERY_FAILURE_USE_DECISION:
    "Đơn cũ bị giữ vì giao thất bại — không gỡ giữ tại đây. Huỷ phần chưa giao ở khối “Lô hàng hoàn về”; muốn gửi lại hàng thì tạo đơn mới.",
  ORDER_DELIVERY_NOT_CORRECTABLE:
    "Không sửa được kết quả giao này nữa: đơn đã hoàn tất, hoặc lần giao đã ghi công nợ cho khách.",
  ORDER_DELIVERY_HAS_RETURN:
    "Lô này đang có yêu cầu trả hàng (đang mở hoặc đã xử lý) — không sửa thành giao thất bại được.",
  SHIPMENT_STATE_CONFLICT:
    "Lô giao không ở trạng thái cho phép thao tác này (chỉ sửa lô đã giao / giao thất bại). Dữ liệu đã được tải lại.",
  // WF-05 Q-12 (BE-17): đóng phần thất lạc
  ORDER_SHIPMENT_NOT_LOST_CLOSABLE:
    "Không đóng phần thất lạc được cho lô này: chỉ lô giao thất bại do hãng báo thất lạc, hàng còn nợ khách, mới đóng theo cách này. Dữ liệu đã được tải lại.",
  ORDER_SHIPMENT_LOSS_EVIDENCE_REQUIRED: "Đính kèm xác nhận thất lạc của hãng vận chuyển.",
} as const;

/**
 * "Đóng phần thất lạc" (WF-05 Q-12, BE-17; contract F-5 + PR-0): lô giao thất bại vì hãng báo thất lạc (`LOST`) không
 * bao giờ về kho nên không có phiếu nhận hàng hoàn. Sale (quyền `sales-lost-shipment-closures:APPROVE`) đóng phần hàng
 * của lô kèm tệp xác nhận thất lạc của hãng; tiền tính như hàng hoàn về (Q-2), NGAY lúc duyệt. Gửi hàng mới = đơn mới.
 */
export const LOST_SHIPMENT_CLOSURE_LABELS = {
  button: "Đóng phần thất lạc",
  title: "Đóng phần thất lạc",
  description: (shipmentLabel: string) =>
    `${shipmentLabel} bị hãng báo thất lạc, hoặc hãng báo đã hoàn về nhưng hàng không về tới kho. Phần hàng của lô bị đóng khỏi đơn và tiền được tính ngay: trừ đợt của lô này trước, rồi nợ cũ, phần thừa thành số phải hoàn; phần phí vận chuyển tương ứng lô này được miễn. Muốn gửi hàng mới thì tạo đơn mới. Không hoàn tác được.`,
  note: "Ghi chú",
  notePlaceholder: "VD: GHN xác nhận mất kiện ngày 20/11, mã khiếu nại 12345",
  evidence: "Xác nhận thất lạc của hãng",
  evidenceHint:
    "Văn bản hãng xác nhận kiện thất lạc: PDF, Word, Excel hoặc ảnh JPEG / PNG, tối đa 25 MB.",
  evidenceRequired: "Đính kèm xác nhận thất lạc của hãng vận chuyển.",
  noteRequired: "Nhập ghi chú.",
  noteTooLong: "Ghi chú tối đa 1000 ký tự.",
  submit: "Đóng phần thất lạc",
  success: "Đã đóng phần thất lạc của lô",
  failedTitle: "Không đóng được phần thất lạc",
  forbidden:
    "Bạn không có quyền đóng phần thất lạc (sales-lost-shipment-closures:APPROVE). Nhờ người có quyền duyệt.",
} as const;
