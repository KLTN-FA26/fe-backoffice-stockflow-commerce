/**
 * Nhãn tiếng Việt của màn hoá đơn điện tử (docs ecommerce/21-e-invoice). Thuật ngữ theo docs và
 * TT 91/2026/TT-BTC: "hoá đơn nháp", "phát hành", "điều chỉnh", "thay thế", "thông báo sai sót".
 */

import type {
  CorrectionBasisRead,
  EInvoiceSystemRejectionCode,
  EInvoiceTypeRead,
  EInvoiceWarning,
} from "./einvoice";

export const EINVOICE_TYPE_LABELS = {
  ORIGINAL: "Hoá đơn gốc",
  ADJUSTMENT: "Hoá đơn điều chỉnh",
  REPLACEMENT: "Hoá đơn thay thế",
  UNKNOWN: "Loại hoá đơn chưa hỗ trợ",
} as const satisfies Record<EInvoiceTypeRead, string>;

export const CORRECTION_BASIS_LABELS = {
  ERROR: "Sai sót (mã số thuế, số lượng, giá, thuế suất, tiền)",
  RETURN: "Trả hàng",
  TRADE_DISCOUNT: "Chiết khấu thương mại",
  DELIVERY_FAILED: "Giao hàng thất bại — hệ thống điều chỉnh giảm toàn bộ",
  UNKNOWN: "Căn cứ chưa hỗ trợ hiển thị",
} as const satisfies Record<CorrectionBasisRead, string>;

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
    withdraw: "Rút hoá đơn",
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
    // BE HĐ-8: không chặn Kế toán phát hành tay, chỉ chặn tự phát hành
    BUYER_EMAIL_MISSING:
      "Bên mua chưa có email nhận hoá đơn — hệ thống không tự phát hành; phát hành tay thì nhà cung cấp không gửi được email, khách vẫn xem trên cổng.",
    TAX_RATE_DIFFERS_FROM_CONTRACT: "Thuế suất trên hoá đơn khác thuế suất đã chốt trên hợp đồng.",
    TAX_RATE_NOT_ON_CONTRACT:
      "Dòng đơn chưa chốt thuế suất — hệ thống tra theo ngày giao, Kế toán cần kiểm tra.",
    // BE PR #369 (defect 4): kiểm lại ngay trước khi tự phát hành
    TAX_RATE_OUT_OF_DATE:
      "Thuế suất trên nháp không còn đúng với thuế suất hiện hành cho ngày lập (nháp lập trước khi kỳ thuế suất được nhập hoặc thuế suất đã đổi). Huỷ và lập lại nháp, hoặc kiểm tra rồi phát hành như hiện tại.",
    // BE HĐ-7: dòng 0% = không chịu thuế (KCT), NCC chưa ghi được
    TAX_EXEMPT_NOT_SUPPORTED:
      "Có dòng hàng không chịu thuế (0%) — chưa phát hành được. Sửa nhóm thuế của sản phẩm rồi huỷ và lập lại nháp.",
    UNKNOWN_TO_PROVIDER:
      "Nhà cung cấp báo không nhận được giao dịch và đã quá thời gian lưu mã giao dịch — chỉ gửi lại khi nhà cung cấp xác nhận không giữ hoá đơn.",
    // BE HĐ-8: hoá đơn vẫn có hiệu lực, chưa gửi khách — lập hoá đơn thay thế
    SIGNATURE_INVALID:
      "Chữ ký số của bên bán trên tệp XML không hợp lệ — hoá đơn chưa được gửi cho khách. Kiểm tra trên cổng nhà cung cấp và lập hoá đơn thay thế.",
    EARLIER_INVOICE_PENDING: "Còn hoá đơn ngày lập sớm hơn chưa phát hành",
    unknown: "Hoá đơn có cảnh báo mới từ hệ thống — xem lại trước khi phát hành.",
  } satisfies Record<EInvoiceWarning | "unknown", string>,
  /** `rejectionCode` hệ thống tự ghi (không phải NCC từ chối) — câu thay cho "Nhà cung cấp từ chối". */
  rejections: {
    UNKNOWN_TO_PROVIDER: "Nhà cung cấp xác nhận không giữ hoá đơn này",
    // BE HĐ-1: Kế toán rút hoá đơn kẹt ở NCC; rejectionMessage = điều Kế toán đã kiểm tra
    WITHDRAWN_NO_PROVIDER_RECORD: "Đã rút khỏi nhà cung cấp (nhà cung cấp không có bản ghi)",
  } satisfies Record<EInvoiceSystemRejectionCode, string>,
} as const;
