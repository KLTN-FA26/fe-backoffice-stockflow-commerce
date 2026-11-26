/**
 * Nhãn tiếng Việt của màn thanh toán (docs ecommerce/15-payment). Thuật ngữ theo docs: "đợt thanh
 * toán", "phiếu thu", "mã tham chiếu sao kê", "công nợ phải thu", "số tiền phải hoàn".
 */

import type { InstallmentReadMilestone, RefundReadStatus, SettlementReadKind } from "./payment";

/** Giá trị BE thêm sau, FE chưa có nhãn (WF-05 BO-11). */
const UNKNOWN_LABEL = "Không rõ";

export const INSTALLMENT_MILESTONE_LABELS = {
  ON_SIGNING: "Khi ký hợp đồng",
  BEFORE_DELIVERY: "Trước khi giao",
  AFTER_DELIVERY: "Sau khi giao",
  // Khoản phí lập khi huỷ đơn hoặc khi đóng phần còn lại (kể cả phần phí của các đợt giao đóng cả lô chuyển sang — audit r3
  // LM-3); nhãn của từng khoản theo tên BE: `installmentMilestoneLabel`
  CANCELLATION_FEE: "Phí huỷ đơn / đóng phần còn lại",
  // Dữ liệu cũ: WF-05 Q-19 bỏ phí chuyến hỏng khỏi code BE (cột DB giữ), không lập khoản mới
  FAILED_TRIP_FEE: "Phí chuyến giao không thành",
  UNKNOWN: UNKNOWN_LABEL,
} as const satisfies Record<InstallmentReadMilestone, string>;

/**
 * Tên khoản phí BE đặt (tiếng Anh, `payment` `OrderSettlement`) → tên tiếng Việt. Audit r3 LM-3: khi đóng phần còn lại cả
 * lô, phần các đợt "trước khi giao" của lô đó còn phải trả trên giá trị hàng đã đóng (phần phí khuôn, phí vận chuyển của
 * lô) chuyển sang khoản phí của lần đóng — không phải phí huỷ đơn. Tên lạ hiện nguyên văn.
 */
export const FEE_ITEM_NAME_LABELS: Readonly<Record<string, string>> = {
  "Cancellation fee": "Phí huỷ đơn",
  "Fee for the rest closed": "Phí đóng phần còn lại",
  "Fee lines of the batches closed": "Phí khuôn, phí vận chuyển của các đợt giao đã đóng",
  "Fee for the rest closed, with the fee lines of the batches closed":
    "Phí đóng phần còn lại, kèm phí khuôn, phí vận chuyển của các đợt giao đã đóng",
};

/** Tên BE của khoản phí huỷ đơn — mọi tên khoản phí khác ở `FEE_ITEM_NAME_LABELS` là khoản lập khi đóng phần còn lại. */
export const CANCELLATION_FEE_ITEM_NAME = "Cancellation fee";

/** Mốc của một khoản phí theo tên BE: khoản huỷ đơn khác khoản lập khi đóng phần còn lại (audit r3 LM-3). */
export const FEE_ITEM_MILESTONE_LABELS = {
  cancellation: "Phí huỷ đơn",
  remainderClosure: "Khoản phải trả khi đóng phần còn lại",
} as const;

/** Tình trạng hoàn tiền (docs 15 §5.3: "Chờ hoàn" / "Hoàn một phần" / "Đã hoàn"). */
export const REFUND_STATUS_LABELS = {
  NONE: "Không có khoản hoàn",
  PENDING: "Chờ hoàn",
  PARTIALLY_REFUNDED: "Hoàn một phần",
  REFUNDED: "Đã hoàn",
  UNKNOWN: UNKNOWN_LABEL,
} as const satisfies Record<RefundReadStatus, string>;

export const SETTLEMENT_KIND_LABELS = {
  ORDER_CANCELLED: "Huỷ đơn",
  REMAINDER_CLOSED: "Đóng phần còn lại",
  GOODS_RETURNED: "Trả hàng",
  // WF-05 Q-2 (BE-03): khách từ chối / vắng, hãng chở hàng về (hoặc thất lạc) — tính lúc kho xác nhận phiếu nhập hàng hoàn
  SHIPMENT_RETURNED: "Lô hãng hoàn về",
  UNKNOWN: UNKNOWN_LABEL,
} as const satisfies Record<SettlementReadKind, string>;

export const PAYMENT_LABELS = {
  /** Tên nhóm sidebar: thanh toán theo hợp đồng, công nợ (docs 15) và hoá đơn điện tử (docs 21). */
  navGroup: "Thanh toán & hoá đơn",
  installments: {
    navLabel: "Đợt thanh toán",
    pageTitle: "Đợt thanh toán",
    receivablesPreset: "Công nợ phải thu",
    receivablesHint:
      "Mọi đợt đã đến mốc mà chưa trả đủ: sau giao, trước giao, quá hạn, phí huỷ, phí giao thất bại",
    customerSearch: "Tìm khách (tên hoặc mã số thuế)",
    customerSearchTooMany: "Có quá nhiều khách khớp — gõ cụ thể hơn",
    reachedOnly: "Chỉ đợt đã đến mốc",
    overdueOnly: "Chỉ đợt quá hạn",
    dueBefore: "Hạn trả trước ngày",
    statusAll: "Mọi trạng thái",
    milestoneAll: "Mọi mốc",
    clearFilters: "Bỏ bộ lọc",
    customerChip: "Khách hàng",
    orderChip: "Đơn hàng",
    orderSearch: "Tìm đơn (số đơn, tên liên hệ, SĐT)",
    filterByOrderCustomer: "Lọc theo khách của đơn",
    emptyTitle: "Chưa có đợt thanh toán",
    emptyDescription:
      "Đợt thanh toán được hệ thống sinh khi hợp đồng chuyển sang Signed — chưa có hợp đồng nào được ký.",
    noReadDescription:
      "Bạn được mở trang nhưng chưa có quyền xem đợt thanh toán. Liên hệ quản trị để được cấp.",
    forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền xem đợt thanh toán.",
    notFoundTitle: "Không tìm thấy đợt thanh toán",
    notFoundDescription: "Đợt thanh toán không tồn tại hoặc đường dẫn không hợp lệ.",
    orderNotFoundTitle: "Đơn này chưa có đợt thanh toán",
    orderNotFoundDescription:
      "Đơn không tồn tại hoặc chưa thuộc hợp đồng đã ký nên chưa sinh đợt thanh toán.",
    noDueDate: "Chưa có hạn",
    batchTied: (seq: number) => `Đợt giao ${seq}`,
    notTied: "Không gắn đợt giao",
    handoverBlocked: "Đang chặn bàn giao",
  },
  columns: {
    contract: "Hợp đồng",
    installment: "Đợt",
    order: "Đơn hàng",
    milestone: "Mốc",
    deliveryBatch: "Đợt giao",
    amount: "Số tiền",
    reduced: "Đã giảm",
    paid: "Đã thu",
    outstanding: "Còn phải thu",
    dueDate: "Hạn trả",
    status: "Trạng thái",
    reference: "Mã tham chiếu sao kê",
    receivedOn: "Ngày nhận",
    recordedAt: "Lập lúc",
    customer: "Khách hàng",
    actions: "Thao tác",
  },
  order: {
    summary: "Tình hình thanh toán của đơn",
    paymentStatus: "Trạng thái thanh toán",
    total: "Tổng các đợt",
    paid: "Đã thu",
    outstanding: "Còn phải thu",
    onSigning: "Đợt khi ký",
    onSigningPaid: "Đã thu đủ",
    onSigningUnpaid: "Chưa thu đủ",
    beforeDeliveryUnpaid: "Đợt trước khi giao còn thiếu",
    dueBeforeHandover: "Phải thu trước khi bàn giao",
    handoverHint:
      "Đợt trước khi giao chưa thu đủ thì chặn bàn giao cho đơn vị vận chuyển; đợt gắn đợt giao chỉ chặn đợt giao đó.",
    installmentsTitle: "Các đợt thanh toán",
    noPaymentStatus: "Mọi đợt đã huỷ",
    paidWhenCancelled: "Đã thanh toán",
    allCancelledHint:
      "Mọi đợt của đơn đã huỷ nên không còn số phải thu. Tiền khách đã trả xử lý ở màn Hoàn tiền.",
  },
  detail: {
    transferReference: "Nội dung chuyển khoản",
    dueDays: "Số ngày hạn trả",
    reachedAt: "Đến mốc lúc",
    paidAt: "Thu đủ lúc",
    cancelledAt: "Huỷ lúc",
    receiptsTitle: "Phiếu thu đã trả cho đợt này",
    noReceipts: "Chưa có phiếu thu nào cho đợt này.",
    viewOrder: "Các đợt của đơn",
    viewCustomer: "Các đợt của khách này",
  },
  receipts: {
    navLabel: "Phiếu thu",
    pageTitle: "Phiếu thu",
    createAction: "Lập phiếu thu",
    searchPlaceholder: "Mã tham chiếu sao kê (khớp chính xác)",
    createHint:
      "Lập phiếu thu từ danh sách đợt thanh toán: mở đợt cần ghi tiền rồi chọn “Lập phiếu thu”.",
    emptyTitle: "Chưa có phiếu thu",
    emptyDescription:
      "Kế toán lập phiếu thu khi đối chiếu sao kê ngân hàng với các đợt thanh toán.",
    noReadDescription:
      "Bạn được mở trang nhưng chưa có quyền xem phiếu thu. Liên hệ quản trị để được cấp.",
    forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền xem phiếu thu.",
    notFoundTitle: "Không tìm thấy phiếu thu",
    notFoundDescription: "Phiếu thu không tồn tại hoặc đường dẫn không hợp lệ.",
    lines: "Các dòng của phiếu thu",
    voidAction: "Huỷ phiếu thu",
    // WF-05 Q-20 (G2 `voidable` / `voidBlockedBy` trên chi tiết phiếu): khoá nút huỷ và nói lý do
    voidBlockedTitle: "Không huỷ được phiếu thu này",
    voidBlockedBy: {
      PAYMENT_RECEIPT_ALREADY_VOIDED: "Phiếu thu đã được huỷ.",
      PAYMENT_RECEIPT_VOID_NOT_ALLOWED:
        "Tiền của đơn đã được tất toán (đơn đã huỷ, hoàn tất, đóng, đang trả hàng hoặc đã ghi nhận hoàn tiền).",
      PAYMENT_RECEIPT_VOID_AFTER_HANDOVER:
        "Phiếu trả khoản “khi ký” / “trước khi giao” và hàng mà khoản đó cho xuất đã bàn giao cho hãng vận chuyển. Ghi nhầm thì sửa bằng chứng từ điều chỉnh ở phần mềm kế toán.",
    } as Readonly<Record<string, string>>,
    voidBlockedUnknown: (code: string) => `Máy chủ không cho huỷ phiếu này (${code}).`,
    // BE `feat/business-documents` #5: phiếu xác nhận thanh toán của một phiếu thu cho một đợt
    confirmationPdf: "Phiếu xác nhận thanh toán",
    voidInfo: "Thông tin huỷ",
    voidedBy: "Người huỷ",
    voidedAt: "Huỷ lúc",
    voidReason: "Lý do huỷ",
    note: "Ghi chú",
    total: "Tổng phiếu",
    statusAll: "Mọi trạng thái",
    customerChip: "Khách hàng",
    receivedFrom: "Nhận từ ngày",
    receivedTo: "Đến ngày",
    rangeInverted: "Từ ngày phải trước hoặc bằng Đến ngày",
    exportAction: "Xuất Excel",
    exporting: "Đang xuất…",
    exportFallbackName: "phieu-thu.xlsx",
    summaryTitle: "Tổng phiếu thu",
    summaryCount: (count: number) => `${count} phiếu thu`,
    summaryNote: "Không tính phiếu đã huỷ.",
    summaryError: "Không tải được tổng phiếu thu.",
  },
  recordDialog: {
    title: "Lập phiếu thu",
    /** BO-UX-39: khách đang trả — để khớp dòng sao kê với đúng khách. */
    titleFor: (customer: string, code: string | null) =>
      `Lập phiếu thu — ${customer}${code ? ` (MST ${code})` : ""}`,
    optionDue: (date: string) => `hạn ${date}`,
    optionOutstanding: (amount: string) => `còn ${amount}`,
    description:
      "Chỉ ghi phần tiền đã xác định được đợt thanh toán. Phiếu đã lập không sửa được — ghi sai thì huỷ phiếu và lập lại.",
    reference: "Mã tham chiếu sao kê",
    referenceHint: "Mỗi dòng sao kê chỉ ghi một phiếu còn hiệu lực.",
    receivedOn: "Ngày nhận",
    note: "Ghi chú",
    linesTitle: "Các đợt được trả",
    addLine: "Thêm đợt khác của khách này",
    removeLine: "Bỏ dòng",
    searchInstallment: "Gõ số đơn, số hợp đồng hoặc tên đợt…",
    noInstallmentMatch: "Không có đợt nào khớp.",
    orderGroup: "Đơn",
    moreInstallments: (count: number) => `Còn ${count} đợt — gõ thêm để thu hẹp`,
    installmentLabel: "Đợt thanh toán",
    amountLabel: "Số tiền (₫)",
    outstandingOf: (amount: string) => `Còn phải thu ${amount}`,
    total: "Tổng phiếu thu",
    submit: "Lập phiếu thu",
    noMoreInstallments: "Khách này không còn đợt nào để ghi thêm.",
    loadFailed: "Không tải được các đợt của khách. Đóng hộp thoại rồi thử lại.",
    pickInstallment: "Chọn đợt…",
    /** Sau khi lập phiếu thu (S07-5): số tiền, liên kết phiếu, và đường quay lại chuyến đang chờ bàn giao. */
    recorded: {
      toastTitle: "Đã lập phiếu thu",
      toastBody: (amount: string, reference: string) => `${amount} — mã sao kê ${reference}`,
      summary: (amount: string, reference: string) =>
        `Đã lập phiếu thu ${amount} (mã sao kê ${reference}).`,
      view: "Xem phiếu thu",
      backToLoad: (code: string) => `Quay lại chuyến ${code}`,
      dismiss: "Đóng",
    },
  },
  voidDialog: {
    title: "Huỷ phiếu thu?",
    description:
      "Phiếu chuyển sang Đã huỷ, giữ nguyên nội dung kèm người huỷ, thời điểm và lý do. Các đợt trong phiếu được tính lại; mã tham chiếu sao kê dùng lại được cho phiếu lập đúng. Phiếu trả khoản “khi ký” / “trước khi giao” của hàng đã bàn giao thì không huỷ được — sửa bằng chứng từ điều chỉnh ở phần mềm kế toán.",
    reason: "Lý do huỷ phiếu thu",
    holdOrders: "Treo đơn nếu huỷ làm đơn đã xác nhận thiếu đợt khi ký",
    holdHint: "Không chọn mà huỷ làm đơn đã xác nhận thiếu đợt khi ký thì thao tác bị từ chối.",
    /** BO-UX-40: các đơn của phiếu — đơn nào có thể bị treo. */
    ordersTitle: "Đơn có tiền trong phiếu này",
    holdOrdersFor: (orders: string) => `Treo các đơn ${orders} nếu huỷ làm đơn thiếu đợt khi ký`,
    submit: "Huỷ phiếu thu",
  },
  refunds: {
    navLabel: "Hoàn tiền",
    pageTitle: "Hoàn tiền",
    outstandingOnly: "Chỉ đơn còn phải hoàn",
    emptyTitle: "Chưa có đơn nào phải hoàn tiền",
    emptyDescription:
      "Số tiền phải hoàn do hệ thống tính khi huỷ đơn, đóng phần còn lại hoặc trả hàng được duyệt hoàn tiền.",
    noReadDescription:
      "Bạn được mở trang nhưng chưa có quyền xem hoàn tiền. Liên hệ quản trị để được cấp.",
    forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền xem hoàn tiền.",
    notFoundTitle: "Không tìm thấy đơn",
    notFoundDescription: "Đơn không tồn tại hoặc chưa có khoản phải hoàn.",
    summary: "Số tiền phải hoàn",
    refundable: "Phải hoàn",
    refunded: "Đã hoàn",
    remaining: "Còn phải hoàn",
    // WF-05 BE-51 (F-9): phí khách còn nợ trên đơn — đọc cạnh số còn phải hoàn
    orderFeeOwed: "Phí khách còn nợ",
    orderFeeOwedHint:
      "Khách còn nợ phí trên đơn này (khoản phí chưa trả, xem ở Đợt thanh toán của đơn).",
    settlements: "Các lần tính",
    records: "Các lần ghi nhận đã hoàn",
    noRecords: "Chưa ghi nhận lần hoàn nào.",
    recordAction: "Ghi nhận đã hoàn",
    voidAction: "Huỷ ghi nhận",
    outsideNote: "Chuyển khoản hoàn làm ngoài hệ thống; ở đây chỉ ghi nhận sau khi đã chuyển.",
    collected: "Đã thu",
    closed: "Giá trị phần đóng",
    reduced: "Đã giảm",
    surplus: "Thu vượt",
    fee: "Phí giữ lại",
    feePercent: "Tỷ lệ phí",
    feeReason: "Lý do phí",
    feeCovered: "Phí đã được tiền thu bù",
    feeOwed: "Phí còn thiếu (khách trả)",
    // WF-05 Q-19 (G2 follow-up): lô hãng hoàn về / thất lạc được miễn phần phí vận chuyển tương ứng giá trị hàng của lô
    // trên giá trị hàng của đơn; đơn kết thúc mà không giao được gì thì miễn toàn bộ phần phí vận chuyển còn lại.
    // Phí khuôn không bao giờ được miễn.
    shippingFeeWaived: "Phí vận chuyển được miễn",
    shippingFeeWaivedHint:
      "Phần phí vận chuyển theo tỷ lệ giá trị hàng của lô hoàn về trên giá trị hàng của đơn; đơn không giao được gì thì miễn toàn bộ phần còn lại. Phí khuôn không được miễn.",
    // F-9: lô hãng hoàn về / thất lạc mà lần tính SHIPMENT_RETURNED đóng
    shipment: "Lô giao",
    openShipment: "Mở lô giao",
    confirmationPdf: "Phiếu hoàn tiền",
    feeItem: "Xem khoản phí",
    // Audit r3 LM-3 (BE `carriedToFee`): phần các đợt "trước khi giao" của lô bị đóng cả lô còn phải trả (phí khuôn, phí
    // vận chuyển của lô) — nằm trong "Đã giảm", chuyển sang khoản phí của lần đóng, đến hạn từ ngày đóng
    carriedToFee: "Chuyển sang khoản phí",
    carriedToFeeHint:
      "Phần phí khuôn, phí vận chuyển của các đợt giao đóng cả lô mà đợt trả trước khi giao còn phải trả: đã giảm khỏi đợt đó, khách trả trên khoản phí của lần đóng, đến hạn từ ngày đóng.",
    settledAt: "Tính lúc",
    refundedOn: "Ngày chuyển",
    recordedAt: "Ghi nhận lúc",
    reference: "Mã tham chiếu sao kê (chiều chi)",
    voidInfo: "Lý do huỷ",
  },
  recordRefundDialog: {
    title: "Ghi nhận đã hoàn tiền",
    description:
      "Nhập sau khi đã chuyển khoản hoàn cho khách. Số tiền không vượt số còn phải hoàn.",
    amount: "Số tiền đã hoàn (₫)",
    refundedOn: "Ngày chuyển",
    reference: "Mã tham chiếu sao kê (chiều chi)",
    note: "Ghi chú",
    submit: "Ghi nhận đã hoàn",
    /** BO-UX-41: người nhận tiền hoàn. */
    payee: "Người nhận tiền hoàn",
    customer: "Khách hàng",
    bankAccount: "Tài khoản nhận",
    noBankAccount: "Chưa có tài khoản ngân hàng trong thông tin pháp lý của khách.",
  },
  voidRefundDialog: {
    title: "Huỷ ghi nhận hoàn tiền?",
    description: "Ghi nhận được giữ lại kèm lý do; số tiền của nó quay lại thành còn phải hoàn.",
    reason: "Lý do huỷ ghi nhận",
    submit: "Huỷ ghi nhận",
  },
  empty: "—",
} as const;

/**
 * Nhãn của các trang danh sách thanh toán sau khi chuyển sang `ListToolbar` (BO-UX-2/7/38) và trang công nợ theo khách
 * (BO-UX-37). Export riêng để không chạm các khối nhãn hộp thoại đang được sửa song song.
 */
export const PAYMENT_LIST_LABELS = {
  filters: "Bộ lọc",
  status: "Trạng thái",
  milestone: "Mốc",
  reached: "Đã đến mốc",
  overdue: "Quá hạn",
  dueBefore: "Hạn trả trước",
  owing: "Công nợ phải thu",
  order: "Đơn hàng",
  pickedOrder: "Đơn đã chọn",
  searchMain: "Tìm kiếm chính",
  notUsed: "Chưa dùng",
  all: "Tất cả",
  yes: "Có",
  overdueDays: (days: number) => (days > 0 ? `Quá hạn ${days} ngày` : "Quá hạn"),
  unknownStatus: "Không rõ",
  receivedRange: "Ngày nhận",
  outstandingOnly: "Còn phải hoàn",
  recordedBy: "Người lập",
  voidedBy: "Người huỷ",
  orderStatusTitle: "Tình hình thanh toán",
  generalTitle: "Thông tin chung",
  statusTitle: "Trạng thái",
  receiptLinesTitle: "Các đợt được trả",
  unknownContract: "Hợp đồng",
  installmentColumns: {
    contract: "Hợp đồng",
    customer: "Khách hàng",
    installment: "Đợt",
    dueDate: "Hạn trả",
    outstanding: "Còn phải thu",
    status: "Trạng thái",
    amount: "Số tiền",
    paid: "Đã thu",
    order: "Đơn hàng",
    milestone: "Mốc",
    batch: "Đợt giao",
    actions: "Thao tác",
  },
} as const;

/** Công nợ phải thu theo khách (BO-UX-37, BE R5-11 `GET /receivables`). */
export const RECEIVABLES_LABELS = {
  navLabel: "Công nợ phải thu",
  pageTitle: "Công nợ phải thu",
  searchPlaceholder: "Tìm khách (tên, mã khách hoặc mã số thuế)",
  customer: "Khách hàng",
  reconciliation: "Đối chiếu công nợ",
  taxCode: "MST",
  owed: "Còn phải thu",
  overdue: "Quá hạn",
  /** BE `signingOverdue`: đợt thu khi ký đã quá hạn — không nằm trong "Còn phải thu" / "Quá hạn" (docs 15 §4.3). */
  signingOverdue: "Quá hạn đợt ký",
  oldestDue: "Hạn cũ nhất",
  d0to30: "0–30 ngày",
  d31to60: "31–60 ngày",
  over60: "> 60 ngày",
  installmentCount: "Số đợt",
  viewInstallments: "Xem các đợt",
  actions: "Thao tác",
  emptyTitle: "Không có khách nào còn nợ",
  emptyDescription: "Khi đợt thanh toán đến mốc mà khách chưa trả đủ, khách sẽ hiện ở đây.",
  noReadDescription:
    "Bạn được mở trang nhưng chưa có quyền xem công nợ. Liên hệ quản trị để được cấp.",
  forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền xem công nợ.",
  notFoundTitle: "Không tải được công nợ",
  notFoundDescription: "Trang công nợ không tồn tại hoặc đường dẫn không hợp lệ.",
  /** BE chưa có `/reports/receivables` (404): xem công nợ theo đợt như trước. */
  fallbackNotice:
    "Chưa có bảng công nợ theo khách trên máy chủ này — đang hiện các đợt còn phải thu (lọc Công nợ phải thu).",
} as const;
