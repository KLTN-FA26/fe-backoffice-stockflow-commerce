/**
 * Nhãn tiếng Việt của màn thanh toán (docs ecommerce/15-payment). Thuật ngữ theo docs: "đợt thanh
 * toán", "phiếu thu", "mã tham chiếu sao kê", "công nợ phải thu", "số tiền phải hoàn".
 */

import type { InstallmentMilestone, RefundApiStatus, SettlementKind } from "./payment";

export const INSTALLMENT_MILESTONE_LABELS = {
  ON_SIGNING: "Khi ký hợp đồng",
  BEFORE_DELIVERY: "Trước khi giao",
  AFTER_DELIVERY: "Sau khi giao",
  CANCELLATION_FEE: "Phí huỷ đơn",
} as const satisfies Record<InstallmentMilestone, string>;

/** Tình trạng hoàn tiền (docs 15 §5.3: "Chờ hoàn" / "Hoàn một phần" / "Đã hoàn"). */
export const REFUND_STATUS_LABELS = {
  NONE: "Không có khoản hoàn",
  PENDING: "Chờ hoàn",
  PARTIALLY_REFUNDED: "Hoàn một phần",
  REFUNDED: "Đã hoàn",
} as const satisfies Record<RefundApiStatus, string>;

export const SETTLEMENT_KIND_LABELS = {
  ORDER_CANCELLED: "Huỷ đơn",
  REMAINDER_CLOSED: "Đóng phần còn lại",
  GOODS_RETURNED: "Trả hàng",
} as const satisfies Record<SettlementKind, string>;

export const PAYMENT_LABELS = {
  navGroup: "Thanh toán",
  installments: {
    navLabel: "Đợt thanh toán",
    pageTitle: "Đợt thanh toán",
    receivablesPreset: "Công nợ phải thu",
    receivablesHint: "Đợt trả sau giao đã đến mốc (docs 15 §4.3)",
    reachedOnly: "Chỉ đợt đã đến mốc",
    dueBefore: "Hạn trả trước ngày",
    statusAll: "Mọi trạng thái",
    milestoneAll: "Mọi mốc",
    clearFilters: "Bỏ bộ lọc",
    customerChip: "Khách hàng",
    orderChip: "Đơn hàng",
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
      "Đợt trước khi giao chưa thu đủ thì chặn bàn giao cho đơn vị vận chuyển (docs 15 BR-08); đợt gắn đợt giao chỉ chặn đợt giao đó.",
    installmentsTitle: "Các đợt thanh toán",
    noPaymentStatus: "Mọi đợt đã huỷ",
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
    voidInfo: "Thông tin huỷ",
    voidedBy: "Người huỷ",
    voidedAt: "Huỷ lúc",
    voidReason: "Lý do huỷ",
    note: "Ghi chú",
    total: "Tổng phiếu",
    statusAll: "Mọi trạng thái",
    customerChip: "Khách hàng",
  },
  recordDialog: {
    title: "Lập phiếu thu",
    description:
      "Chỉ ghi phần tiền đã xác định được đợt thanh toán. Phiếu đã lập không sửa được — ghi sai thì huỷ phiếu và lập lại (docs 15 BR-04).",
    reference: "Mã tham chiếu sao kê",
    referenceHint: "Mỗi dòng sao kê chỉ ghi một phiếu còn hiệu lực (BR-03).",
    receivedOn: "Ngày nhận",
    note: "Ghi chú",
    linesTitle: "Các đợt được trả",
    addLine: "Thêm đợt",
    removeLine: "Bỏ dòng",
    installmentLabel: "Đợt thanh toán",
    amountLabel: "Số tiền (₫)",
    outstandingOf: (amount: string) => `Còn phải thu ${amount}`,
    total: "Tổng phiếu thu",
    submit: "Lập phiếu thu",
    noMoreInstallments: "Khách này không còn đợt nào để ghi thêm.",
    loadFailed: "Không tải được các đợt của khách. Đóng hộp thoại rồi thử lại.",
    pickInstallment: "Chọn đợt…",
  },
  voidDialog: {
    title: "Huỷ phiếu thu?",
    description:
      "Phiếu chuyển sang Voided, giữ nguyên nội dung kèm người huỷ, thời điểm và lý do. Các đợt trong phiếu được tính lại; mã tham chiếu sao kê dùng lại được cho phiếu lập đúng.",
    reason: "Lý do huỷ phiếu thu",
    holdOrders: "Treo đơn nếu huỷ làm đơn đã xác nhận thiếu đợt khi ký",
    holdHint:
      "Không chọn mà huỷ làm đơn đã Confirmed thiếu đợt khi ký thì thao tác bị từ chối (docs 15 BR-13).",
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
    settlements: "Các lần tính",
    records: "Các lần ghi nhận đã hoàn",
    noRecords: "Chưa ghi nhận lần hoàn nào.",
    recordAction: "Ghi nhận đã hoàn",
    voidAction: "Huỷ ghi nhận",
    outsideNote:
      "Chuyển khoản hoàn làm ngoài hệ thống; ở đây chỉ ghi nhận sau khi đã chuyển (docs 15 §4.5 bước 16).",
    collected: "Đã thu",
    closed: "Giá trị phần đóng",
    reduced: "Đã giảm",
    surplus: "Thu vượt",
    fee: "Phí giữ lại",
    feePercent: "Tỷ lệ phí",
    feeReason: "Lý do phí",
    feeCovered: "Phí đã được tiền thu bù",
    feeOwed: "Phí còn thiếu (khách trả)",
    feeItem: "Xem khoản phí huỷ",
    settledAt: "Tính lúc",
    refundedOn: "Ngày chuyển",
    recordedAt: "Ghi nhận lúc",
    reference: "Mã tham chiếu sao kê (chiều chi)",
    voidInfo: "Lý do huỷ",
  },
  recordRefundDialog: {
    title: "Ghi nhận đã hoàn tiền",
    description:
      "Nhập sau khi đã chuyển khoản hoàn cho khách. Số tiền không vượt số còn phải hoàn (docs 15 BR-14).",
    amount: "Số tiền đã hoàn (₫)",
    refundedOn: "Ngày chuyển",
    reference: "Mã tham chiếu sao kê (chiều chi)",
    note: "Ghi chú",
    submit: "Ghi nhận đã hoàn",
  },
  voidRefundDialog: {
    title: "Huỷ ghi nhận hoàn tiền?",
    description: "Ghi nhận được giữ lại kèm lý do; số tiền của nó quay lại thành còn phải hoàn.",
    reason: "Lý do huỷ ghi nhận",
    submit: "Huỷ ghi nhận",
  },
  empty: "—",
} as const;
