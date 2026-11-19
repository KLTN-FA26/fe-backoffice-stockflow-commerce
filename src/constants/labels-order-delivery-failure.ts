/**
 * Giao thất bại (WF-05 GH-1; docs 09 §4.3, 17 §4.8) — BE `DeliveryFailureController` / `DeliveryFailureService`.
 *
 * Hãng mang lô về, kho nhận lại hàng trên phiếu nhận hàng hoàn → BE mở một "hồ sơ giao thất bại" (`OPEN`) và giữ đơn
 * (`ON_HOLD`, lý do `DELIVERY_FAILED`). Sale quyết: giao lại (`REDELIVERY` → `REDELIVERED` khi bàn giao lại) hoặc huỷ phần
 * chưa giao (`CANCELLED`). Enum lấy nguyên văn từ BE `DeliveryFailureCase.Status`.
 */

/** BE `DeliveryFailureCase.Status`. */
export const DELIVERY_FAILURE_CASE_STATUSES = [
  "OPEN",
  "REDELIVERY",
  "REDELIVERED",
  "CANCELLED",
] as const;

/** Hồ sơ đã đóng (BE `Status#isClosed`): không quyết định lại. */
export const DELIVERY_FAILURE_CLOSED_STATUSES = ["REDELIVERED", "CANCELLED"] as const;

/** Trạng thái hồ sơ → chuỗi status sẵn có của `StatusDot` (chỉ để lấy tone); nhãn Việt ở `statusLabels`. */
export const DELIVERY_FAILURE_CASE_STATUS_DISPLAY = {
  OPEN: "On Hold",
  REDELIVERY: "In Progress",
  REDELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  UNKNOWN: "UNKNOWN",
} as const;

/** Lý do giao thất bại khách gây ra (BE `customerPaysFailedTrip`): giao lại phải tính phí chuyến hỏng. */
export const DELIVERY_FAILURE_CUSTOMER_PAID_REASONS = ["REFUSED", "WRONG_ADDRESS"] as const;

/** Giới hạn ô nhập — BE `DeliveryFailureCaseRequests` / `CancellationFeeRequest`. */
export const DELIVERY_FAILURE_LIMITS = {
  noteMax: 1000,
  feeReasonMax: 500,
  feeDetailMax: 2000,
  /** BE `GET /orders/delivery-failures?limit` — mặc định 50, tối đa 200. */
  listLimit: 200,
} as const;

export const DELIVERY_FAILURE_LABELS = {
  /** Mục menu + tiêu đề (ẩn) của trang hàng đợi. */
  title: "Giao thất bại",
  subtitle:
    "Lô hãng mang về và kho đã nhận lại hàng. Sale quyết định giao lại hoặc huỷ phần chưa giao; đơn bị giữ tới khi quyết định.",
  statusLabels: {
    OPEN: "Chờ Sale quyết định",
    REDELIVERY: "Đang giao lại",
    REDELIVERED: "Đã giao lại",
    CANCELLED: "Đã huỷ phần chưa giao",
    UNKNOWN: "Không rõ",
  },
  filter: {
    label: "Trạng thái hồ sơ",
    open: "Chờ quyết định",
    all: "Tất cả",
  },
  columns: {
    order: "Đơn hàng",
    receipt: "Phiếu nhận hàng hoàn",
    reason: "Lý do giao thất bại",
    openedAt: "Mở lúc",
    status: "Trạng thái",
    actions: "Thao tác",
  },
  empty: {
    title: "Không có hồ sơ giao thất bại nào chờ quyết định",
    description:
      "Khi kho nhận lại hàng của một lô giao không thành công, hồ sơ sẽ hiện ở đây để Sale quyết định.",
  },
  emptyAll: {
    title: "Chưa có hồ sơ giao thất bại",
    description: "Chưa có lô nào bị hãng mang về và được kho nhận lại.",
  },
  loadFailed: "Không tải được danh sách giao thất bại.",
  caption: (shown: number) => `${shown} hồ sơ`,
  /** Khối "Giao thất bại" trong chi tiết đơn. */
  section: {
    title: "Giao thất bại",
    loading: "Đang tải hồ sơ giao thất bại…",
    failed: "Không tải được hồ sơ giao thất bại của đơn.",
    none: "Đơn chưa có lô nào giao thất bại.",
    uncased:
      "Có lô hãng đã mang về nhưng kho chưa lập phiếu nhận hàng hoàn. Có thể huỷ phần chưa giao ngay mà không chờ hàng về.",
    receipt: (number: string) => `Phiếu ${number}`,
    openedAt: (when: string) => `Mở lúc ${when}`,
    decidedAt: (when: string) => `Quyết định lúc ${when}`,
    decisionNote: "Ghi chú quyết định",
    failureNote: "Ghi chú của hãng / kho",
    failedTripFee: "Phí chuyến giao hỏng",
    carrierClaim: "Không thu khách — đòi hãng vận chuyển",
    readyForRelease: "Đã giữ đủ hàng — chờ Quản lý kho release để giao lại",
    units: (units: number, held: number) => `${units} sp về kho · đã giữ lại ${held}`,
    cartons: (count: number) => `${count} thùng`,
  },
  redeliver: {
    button: "Giao lại",
    title: "Giao lại hàng",
    description: (receipt: string) =>
      `Hàng của phiếu ${receipt} được giữ lại cho đơn; Quản lý kho release để giao lại thành lô mới. Đơn ra khỏi trạng thái giữ khi không còn hồ sơ nào chờ.`,
    note: "Ghi chú quyết định",
    notePlaceholder: "VD: Khách xác nhận nhận hàng thứ Sáu, địa chỉ đã sửa",
    fee: "Phí chuyến giao hỏng (VND)",
    feeHint:
      "Khách từ chối nhận / sai địa chỉ nên chịu phí chuyến hỏng — ghi thành một khoản phí trên hợp đồng.",
    noFeeHint: "Lý do không do khách — không thu phí, chi phí đòi hãng vận chuyển.",
    submit: "Giao lại",
    success: "Đã quyết định giao lại",
    failedTitle: "Không giao lại được",
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
    feeRequired: "Nhập phí chuyến giao hỏng (số nguyên VND lớn hơn 0).",
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
    "Đơn bị giữ vì giao thất bại — không gỡ giữ tại đây. Quyết định giao lại hoặc huỷ phần chưa giao ở khối “Giao thất bại”.",
  ORDER_DELIVERY_NOT_CORRECTABLE:
    "Không sửa được kết quả giao này nữa: đơn đã hoàn tất, hoặc lần giao đã ghi công nợ cho khách.",
  ORDER_DELIVERY_HAS_RETURN:
    "Lô này đang có yêu cầu trả hàng (đang mở hoặc đã xử lý) — không sửa thành giao thất bại được.",
  SHIPMENT_STATE_CONFLICT:
    "Lô giao không ở trạng thái cho phép thao tác này (chỉ sửa lô đã giao / giao thất bại). Dữ liệu đã được tải lại.",
} as const;
