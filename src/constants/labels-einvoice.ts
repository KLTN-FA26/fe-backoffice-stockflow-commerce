/**
 * Nhãn tiếng Việt của màn hoá đơn điện tử (docs ecommerce/21-e-invoice). Thuật ngữ theo docs và
 * TT 91/2026/TT-BTC: "hoá đơn nháp", "phát hành", "điều chỉnh", "thay thế", "thông báo sai sót".
 */

import type { CorrectionBasis, EInvoiceType } from "./einvoice";

export const EINVOICE_TYPE_LABELS = {
  ORIGINAL: "Hoá đơn gốc",
  ADJUSTMENT: "Hoá đơn điều chỉnh",
  REPLACEMENT: "Hoá đơn thay thế",
} as const satisfies Record<EInvoiceType, string>;

export const CORRECTION_BASIS_LABELS = {
  ERROR: "Sai sót (mã số thuế, số lượng, giá, thuế suất, tiền)",
  RETURN: "Trả hàng",
  TRADE_DISCOUNT: "Chiết khấu thương mại",
} as const satisfies Record<CorrectionBasis, string>;

export const EINVOICE_LABELS = {
  navGroup: "Hoá đơn",
  list: {
    navLabel: "Hoá đơn điện tử",
    pageTitle: "Hoá đơn điện tử",
    pendingPreset: "Chờ phát hành",
    overdueOnly: "Quá hạn phát hành",
    statusAll: "Mọi trạng thái",
    typeAll: "Mọi loại",
    issuedFrom: "Ngày lập từ",
    issuedTo: "đến",
    orderChip: "Đơn hàng",
    customerChip: "Khách hàng",
    clearFilters: "Bỏ bộ lọc",
    drawUp: "Lập nháp",
    emptyTitle: "Chưa có hoá đơn điện tử",
    emptyDescription:
      "Hoá đơn nháp được hệ thống tạo khi một lần giao thành công (shipment Delivered).",
    noReadDescription:
      "Bạn được mở trang nhưng chưa có quyền xem hoá đơn điện tử. Liên hệ quản trị để được cấp.",
  },
  columns: {
    reference: "Số hoá đơn",
    type: "Loại",
    order: "Đơn hàng",
    shipment: "Lần giao",
    buyer: "Bên mua",
    issueDate: "Ngày lập",
    dueAt: "Hạn phát hành",
    grandTotal: "Tổng có thuế",
    status: "Trạng thái",
  },
  detail: {
    general: "Thông tin chung",
    buyer: "Bên mua",
    seller: "Bên bán",
    lines: "Dòng hàng",
    totals: "Tổng theo thuế suất",
    providerCalls: "Nhật ký gọi nhà cung cấp",
    corrections: "Điều chỉnh / thay thế",
    errorNotices: "Thông báo sai sót",
    notFoundTitle: "Không tìm thấy hoá đơn điện tử",
    notFoundDescription: "Hoá đơn không tồn tại hoặc đường dẫn không hợp lệ.",
  },
  actions: {
    revise: "Sửa nháp",
    refreshBuyer: "Làm mới bên mua",
    issue: "Phát hành",
    void: "Huỷ nháp",
    reconcile: "Tra lại",
    resubmit: "Gửi lại như giao dịch mới",
    reopen: "Mở lại thành nháp",
    attachAgreement: "Gắn thoả thuận",
    adjust: "Lập điều chỉnh",
    replace: "Lập thay thế",
    notifyError: "Thông báo sai sót",
    downloadXml: "Tải XML",
    downloadPdf: "Tải PDF",
  },
  warnings: {
    BUYER_PROFILE_INCOMPLETE:
      "Hồ sơ bên mua thiếu tên, mã số thuế hoặc địa chỉ — chưa phát hành được (BR-06).",
    TAX_RATE_DIFFERS_FROM_CONTRACT: "Thuế suất trên hoá đơn khác thuế suất đã chốt trên hợp đồng.",
    TAX_RATE_NOT_ON_CONTRACT:
      "Dòng đơn chưa chốt thuế suất — hệ thống tra theo ngày giao, Kế toán cần kiểm tra.",
    UNKNOWN_TO_PROVIDER:
      "Nhà cung cấp báo không nhận được giao dịch và đã quá thời gian lưu mã giao dịch — chỉ gửi lại khi nhà cung cấp xác nhận không giữ hoá đơn.",
    EARLIER_INVOICE_PENDING: "Còn hoá đơn ngày lập sớm hơn chưa phát hành",
    unknown: "Hoá đơn có cảnh báo mới từ hệ thống — xem lại trước khi phát hành.",
  },
} as const;
