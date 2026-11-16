/**
 * Yêu cầu huỷ của khách (docs 17 §4.8 bước 28–31, §5.4; BE `CancellationRequestController`). Khách chỉ gửi yêu cầu
 * (không tự huỷ ngay); Sale duyệt → huỷ đơn kèm phí nếu có, hoặc từ chối kèm lý do. Trạng thái yêu cầu hiển thị theo
 * docs §5.4: `Pending` / `Approved` / `Rejected` / `Expired`.
 */

/** BE `CancellationRequestStatus` → trạng thái hiển thị nguyên văn trong docs 17 §5.4 (nhãn Việt do `StatusDot`). */
export const CANCELLATION_REQUEST_STATUS_DISPLAY = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
} as const;

export const CANCELLATION_REQUEST_LABELS = {
  /** Tên mục menu + tiêu đề trang hàng đợi. */
  title: "Yêu cầu huỷ đơn",
  subtitle:
    "Yêu cầu huỷ của khách cho đơn đã chốt hợp đồng. Duyệt thì đơn bị huỷ ngay (kèm phí nếu có), từ chối thì phải ghi lý do.",
  backToOrders: "Đơn hàng",
  empty: {
    title: "Không có yêu cầu huỷ nào đang chờ",
    description: "Khi khách gửi yêu cầu huỷ đơn, yêu cầu sẽ hiện ở đây để Sale quyết định.",
  },
  columns: {
    order: "Đơn hàng",
    reason: "Lý do khách nêu",
    requestedAt: "Gửi lúc",
    status: "Trạng thái",
  },
  caption: (shown: number, total: number) => `Hiển thị ${shown} / ${total} yêu cầu`,
  /** Thẻ "Yêu cầu huỷ" trên trang chi tiết đơn. */
  card: {
    title: "Yêu cầu huỷ của khách",
    loading: "Đang tải yêu cầu huỷ…",
    failed: "Không tải được yêu cầu huỷ của đơn.",
    none: "Khách chưa gửi yêu cầu huỷ cho đơn này.",
    requestedAt: (when: string) => `Gửi lúc ${when}`,
    decidedAt: (when: string) => `Quyết định lúc ${when}`,
    customerNote: "Ghi chú của khách",
    decisionNote: "Ghi chú quyết định",
    retained: (percent: string) => `Giữ ${percent}% số tiền đã thu`,
    history: "Các yêu cầu trước",
  },
  approve: {
    button: "Duyệt huỷ",
    title: "Duyệt yêu cầu huỷ",
    description: (orderNumber: string) =>
      `Duyệt thì đơn ${orderNumber} bị huỷ ngay: nhả hàng giữ, dừng lấy hàng, huỷ Đơn sản xuất chưa in hàng loạt. Không hoàn tác được.`,
    submit: "Duyệt và huỷ đơn",
    noteLabel: "Ghi chú quyết định (khách đọc được)",
    success: "Đã duyệt yêu cầu huỷ — đơn đã huỷ",
    failedTitle: "Không duyệt được yêu cầu huỷ",
  },
  /** Phí giữ lại (docs 17 §4.8 bước 30): chỉ khi Đơn sản xuất đã in hàng loạt (`In Production` trở đi). */
  fee: {
    legend: "Phí giữ lại từ tiền khách đã thu",
    none: "Không giữ phí — hoàn toàn bộ",
    percent: "Giữ theo % số tiền đã thu",
    agreed: "Giữ theo số tiền thoả thuận với khách",
    hint: "Chỉ giữ được phí khi Đơn sản xuất của đơn đã in hàng loạt (từ In Production). Chưa in thì hoàn toàn bộ và máy chủ từ chối nếu có phí. Tiền đã thu trả phí trước, phần thừa thành tiền phải hoàn, phần phí thiếu thành khoản phí huỷ.",
    percentLabel: "Giữ lại (%)",
    percentInvalid: "Nhập tỷ lệ lớn hơn 0 và tối đa 100 (tối đa 2 chữ số thập phân)",
    bothChosen: "Chỉ chọn một: tỷ lệ HOẶC số tiền thoả thuận",
    amountLabel: "Số tiền phí (VND)",
    reasonLabel: "Lý do giữ phí",
    detailLabel: "Chi tiết đã thoả thuận với khách",
  },
  reject: {
    button: "Từ chối",
    title: "Từ chối yêu cầu huỷ",
    description: (orderNumber: string) =>
      `Đơn ${orderNumber} vẫn tiếp tục. Khách sẽ đọc lý do từ chối bạn ghi dưới đây.`,
    submit: "Từ chối yêu cầu",
    noteLabel: "Lý do từ chối (khách đọc được)",
    noteRequired: "Hãy ghi lý do từ chối",
    success: "Đã từ chối yêu cầu huỷ",
    failedTitle: "Không từ chối được yêu cầu huỷ",
  },
  /** Kết quả tất toán sau khi duyệt (BE `GET /refunds/orders/{id}`, docs 15 §4.5–4.6, 17 §4.8 bước 30). */
  settlement: {
    title: "Kết quả tất toán tiền",
    loading: "Đang tải kết quả tất toán…",
    failed: "Không tải được kết quả tất toán — xem lại ở màn Hoàn tiền của Kế toán.",
    none: "Chưa có kết quả tất toán (đơn chưa thu tiền hoặc chưa huỷ).",
    collected: "Đã thu",
    fee: "Phí giữ lại",
    feePercent: (percent: string) => `(${percent}% số tiền đã thu)`,
    feeCovered: "Phí đã trừ vào tiền đã thu",
    refundable: "Tiền phải hoàn khách",
    feeOwed: "Khoản phí huỷ còn phải thu",
    feeReason: "Lý do giữ phí",
    feeDetail: "Chi tiết thoả thuận",
    accountantNote:
      "Kế toán chuyển hoàn ngoài hệ thống rồi ghi nhận đã hoàn (docs 15 §4.5); khoản phí còn thiếu thành khoản phí huỷ (docs 15 §4.6).",
  },
} as const;

/**
 * Lý do BE từ chối quyết định yêu cầu huỷ — câu Việt + mã quy tắc docs. BE trả câu tiếng Anh nên không hiện thẳng.
 */
export const CANCELLATION_REQUEST_ERROR_MESSAGES = {
  /** 409 ORDER_NOT_CANCELLABLE (docs 17 §4.8 bước 31, BR-12): đã có thùng dán nhãn giao hàng / đã bàn giao / đã huỷ. */
  notCancellable:
    "Đơn đã có thùng được kiểm và dán nhãn giao hàng (hoặc đã bàn giao, đã huỷ) nên không huỷ được nữa. Yêu cầu sẽ tự hết hiệu lực — hướng khách sang trả hàng. Dữ liệu đã được tải lại.",
  notCancellableRule: "17 §4.8 bước 31",
  /** 409 ORDER_CANCELLATION_REQUEST_NOT_PENDING: đã được quyết định hoặc đã hết hiệu lực. */
  notPending:
    "Yêu cầu này đã được quyết định hoặc đã hết hiệu lực (đơn đã tới mức không huỷ được). Dữ liệu đã được tải lại.",
  notPendingRule: "17 §5.4",
  /** 404 CANCELLATION_REQUEST_NOT_FOUND / NOT_FOUND. */
  notFound:
    "Không tìm thấy yêu cầu huỷ này (đã bị xoá hoặc ngoài phạm vi của bạn). Dữ liệu đã được tải lại.",
  /** 409 CANCELLATION_FEE_BEFORE_PRINTING (docs 17 §4.8 bước 30, BR-11). */
  feeBeforePrinting:
    "Đơn chưa có Đơn sản xuất nào in hàng loạt nên phải hoàn toàn bộ, không giữ phí. Chọn “Không giữ phí” rồi duyệt lại.",
  feeBeforePrintingRule: "BR-11",
  /** 409 CANCELLATION_NEEDS_STAFF (chỉ khi hệ thống tự huỷ; giữ để không rơi vào câu chung). */
  needsStaff: "Đơn đã bắt đầu in nên chỉ nhân viên quyết định được việc huỷ.",
  /** 400 VALIDATION_FAILED — BE trả câu tiếng Anh chung cho nhiều lỗi nên FE nêu các điều kiện cần kiểm. */
  validationApprove:
    "Kiểm tra lại tỷ lệ giữ lại (0–100, tối đa 2 chữ số thập phân) hoặc số tiền thoả thuận (số nguyên VND, lớn hơn 0, không vượt tổng đơn, kèm lý do và chi tiết) — chỉ chọn một trong hai.",
  validationReject: "Hãy ghi lý do từ chối (bắt buộc, tối đa 1000 ký tự).",
} as const;
