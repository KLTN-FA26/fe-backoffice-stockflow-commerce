/**
 * Nhãn tiếng Việt của màn hoá đơn điện tử (docs ecommerce/21-e-invoice). Thuật ngữ theo docs và
 * TT 91/2026/TT-BTC: "hoá đơn nháp", "phát hành", "điều chỉnh", "thay thế", "thông báo sai sót".
 */

import type {
  CorrectionBasisRead,
  EInvoiceSystemRejectionCode,
  EInvoiceIssueCheck,
  EInvoiceTypeRead,
  EInvoiceUnknown,
  EInvoiceWarning,
  PortalResultOutcome,
  SignatureStatus,
  WithdrawalBlock,
  WithdrawalProviderState,
} from "./einvoice";

/** Tên hiển thị của nhà cung cấp (BE `EInvoiceProvider.code()`); mã lạ hiện nguyên văn. */
export const EINVOICE_PROVIDER_LABELS: Readonly<Record<string, string>> = {
  SANDBOX: "Sandbox (thử nghiệm, không có giá trị pháp lý)",
  SEPAY_EINVOICE: "SePay eInvoice",
  VIETTEL_SINVOICE: "Viettel SInvoice",
};

/** Chữ ký số trên XML (BE `EInvoiceSignatureResponse.status`, WF-05 F-18). */
export const SIGNATURE_STATUS_LABELS = {
  VALID: "Hợp lệ — nội dung đúng như lúc ký",
  CONTENT_CHANGED: "Nội dung đã bị sửa sau khi ký",
  SIGNATURE_INVALID: "Chữ ký không hợp lệ",
  NOT_SIGNED: "Không có chữ ký của bên bán",
  UNREADABLE: "Tệp không đọc được (không phải XML hoá đơn)",
  SHA1_UNCHECKED: "Ký bằng SHA-1 — hệ thống chưa kiểm được (không phải chữ ký sai)",
  UNKNOWN: "Kết quả kiểm chưa hỗ trợ hiển thị",
} as const satisfies Record<SignatureStatus | EInvoiceUnknown, string>;

/** Câu trả lời của NCC khi BE từ chối rút hoá đơn (`details.providerState`, WF-05 F-12, Q-5). */
export const WITHDRAWAL_PROVIDER_STATE_LABELS = {
  PENDING:
    "Nhà cung cấp đã nhận và đang xử lý hoá đơn (kể cả “đã phát hành nhưng chưa có số”) — hoá đơn đang chờ, không bao giờ rút. Bấm “Kiểm tra lại” sau.",
  UNKNOWN: "Nhà cung cấp chưa trả lời rõ về hoá đơn này.",
  NOT_FOUND: "Nhà cung cấp chưa có bản ghi của hoá đơn này.",
  UNCONFIRMED:
    "Không xác nhận được kết quả với nhà cung cấp — chỉ rút khi có văn bản trả lời của bộ phận hỗ trợ nhà cung cấp: nhập số phiếu hoặc nội dung trả lời.",
  ISSUED:
    "Nhà cung cấp cho biết hoá đơn đã phát hành — không rút. Bấm “Kiểm tra lại” để nhận số hoá đơn.",
  REJECTED:
    "Nhà cung cấp cho biết hoá đơn đã bị từ chối — bấm “Kiểm tra lại” để hệ thống ghi kết quả đó.",
} as const satisfies Record<WithdrawalProviderState, string>;

/**
 * Vì sao chưa có nút "Rút hoá đơn" (BE `withdrawalBlockedBy`, audit r2 H-2) — hiện thay cho nút trên hoá đơn đang gửi.
 * TOO_RECENT ghép thêm "Rút được từ <giờ>" theo `withdrawableFrom`. NOT_AT_PROVIDER không hiện (hoá đơn không đang gửi).
 */
export const WITHDRAWAL_BLOCK_LABELS = {
  NOT_AT_PROVIDER: "Hoá đơn không đang chờ nhà cung cấp nên không rút được.",
  PROVIDER_HOLDS:
    "Nhà cung cấp đang giữ hoá đơn (đã phát hành chưa có số, hoặc đang xử lý) — hoá đơn đang chờ, không bao giờ rút. Bấm “Kiểm tra lại” để nhận kết quả.",
  TOO_RECENT: "Hoá đơn vừa gửi, nhà cung cấp có thể vẫn đang xử lý nên chưa rút được.",
  PROVIDER_STATE_UNCLEAR:
    "Nhà cung cấp chưa xác nhận là không có bản ghi của hoá đơn nên chưa rút được. Bấm “Kiểm tra lại”, hoặc ghi kết quả đã kiểm trên cổng nhà cung cấp.",
  UNKNOWN: "Hiện chưa rút được hoá đơn này.",
} as const satisfies Record<WithdrawalBlock | EInvoiceUnknown, string>;

/** Điều BE thấy khi kiểm lại nháp lúc phát hành tay, không phải cảnh báo lưu trên hoá đơn (WF-05 F-16). */
export const EINVOICE_ISSUE_CHECK_LABELS = {
  BUYER_PROFILE_CHANGED:
    "Hồ sơ pháp lý của khách đang ghi bên mua khác với nháp (tên, mã số thuế hoặc địa chỉ). Bấm “Làm mới bên mua” để chép lại, hoặc phát hành nếu nháp đã đúng.",
} as const satisfies Record<EInvoiceIssueCheck, string>;

/** Kết quả ghi lại từ cổng NCC (WF-05 F-13). */
export const PORTAL_RESULT_OUTCOME_LABELS = {
  ISSUED: "Đã phát hành trên cổng nhà cung cấp",
  REFUSED_BY_TAX_AUTHORITY: "Cơ quan thuế từ chối",
} as const satisfies Record<PortalResultOutcome, string>;

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

/** Căn cứ của hoá đơn giảm ghi từ cổng NCC (`EXTERNAL_REDUCTION_BASES`). */
export const EXTERNAL_REDUCTION_BASIS_LABELS = {
  DELIVERY_FAILED: "Giao hàng thất bại",
  // Audit r3 EINV-2: cả hoá đơn gốc của NCC cũ (bản điều chỉnh trả hàng đã huỷ vì không gửi được), không chỉ hoá đơn thay thế
  RETURN: "Trả hàng (hàng đã hoàn tiền)",
  // Audit r3 EINV-2: điều chỉnh sai sót đã thoả thuận, lập trong hệ thống nhưng không gửi được nên đã huỷ để làm trên cổng
  ERROR: "Điều chỉnh sai sót (bản nháp đã huỷ để làm trên cổng)",
} as const;

export const EINVOICE_LABELS = {
  navGroup: "Hoá đơn",
  list: {
    navLabel: "Hoá đơn điện tử",
    pageTitle: "Hoá đơn điện tử",
    pendingPreset: "Chờ phát hành",
    overdueOnly: "Quá hạn phát hành",
    /** WF-05 Q-10: hoá đơn phát hành sau ngày giao (cảnh báo ISSUED_LATE). */
    lateOnly: "Hoá đơn lập trễ",
    statusAll: "Mọi trạng thái",
    typeAll: "Mọi loại",
    issuedFrom: "Ngày lập từ",
    issuedTo: "đến",
    orderChip: "Đơn hàng",
    /** Chip lọc theo đơn khi chưa có dòng nào mang số đơn — không hiện UUID. */
    orderChipUnknown: "Đơn đã chọn",
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
    /** WF-05 HĐ-3: lần giao của hoá đơn bị sửa thành thất bại (`deliveryFailedAt`). */
    deliveryFailedAt: "Giao thất bại lúc",
    buyer: "Bên mua",
    seller: "Bên bán",
    lines: "Dòng hàng",
    totals: "Tổng theo thuế suất",
    providerCalls: "Nhật ký gọi nhà cung cấp",
    corrections: "Điều chỉnh / thay thế",
    errorNotices: "Thông báo sai sót",
    /** #286: hoá đơn gốc của hoá đơn điều chỉnh / thay thế — ký hiệu + số do BE kèm. */
    original: "Hoá đơn gốc",
    viewOriginal: "Xem hoá đơn gốc",
    recordedBy: (name: string) => `bởi ${name}`,
    signature: "Chữ ký số",
    /** WF-05 F-13: hoá đơn ghi lại từ cổng NCC, không phát hành qua API. */
    issuedViaPortal: "Ghi lại từ cổng nhà cung cấp",
    notFoundTitle: "Không tìm thấy hoá đơn điện tử",
    notFoundDescription: "Hoá đơn không tồn tại hoặc đường dẫn không hợp lệ.",
  },
  actions: {
    revise: "Sửa nháp",
    refreshBuyer: "Làm mới bên mua",
    issue: "Phát hành",
    void: "Huỷ nháp",
    reconcile: "Kiểm tra lại",
    resubmit: "Gửi lại như giao dịch mới",
    reopen: "Mở lại thành nháp",
    withdraw: "Rút hoá đơn",
    attachAgreement: "Gắn thoả thuận",
    adjust: "Lập điều chỉnh",
    replace: "Lập thay thế",
    notifyError: "Thông báo sai sót",
    // WF-05 Q-8 (F-13, F-14), BE-11 (F-15)
    recordPortalResult: "Ghi kết quả từ cổng NCC",
    recordExternalReduction: "Ghi hoá đơn giảm làm trên cổng NCC",
    voidUnsendable: "Huỷ bản không gửi được",
    reduceFailedDelivery: "Lập bản giảm do giao thất bại",
    resendEmail: "Gửi lại hoá đơn qua e-mail",
    downloadXml: "Tải XML",
    downloadPdf: "Tải PDF",
  },
  warnings: {
    BUYER_PROFILE_INCOMPLETE:
      "Hồ sơ bên mua thiếu tên, mã số thuế hoặc địa chỉ — chưa phát hành được.",
    // BE HĐ-8: không chặn Kế toán phát hành tay, chỉ chặn tự phát hành
    // WF-05 Q-14 + Q-22 BR-06: email không phải nội dung bắt buộc của hoá đơn — không chặn cả tự phát hành; BE gửi thư
    BUYER_EMAIL_MISSING:
      "Bên mua chưa có email nhận hoá đơn — hoá đơn vẫn phát hành đúng ngày (kể cả tự phát hành), nhưng hệ thống chưa gửi được email cho khách. Nhờ Sale bổ sung email rồi gửi lại; khách vẫn xem trên cổng.",
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
    // WF-05 Q-21 (Luật GTGT 48/2024 Điều 9 khoản 4): không xác định được mức thì tính mức cao nhất
    TAX_CLASS_UNKNOWN:
      "Có sản phẩm chưa xác định nhóm thuế — tính mức cao nhất 10% và không tự phát hành. Gán nhóm thuế cho sản phẩm, huỷ nháp rồi lập lại; hoặc kiểm tra rồi phát hành như hiện tại.",
    // WF-05 Q-10: hoá đơn mang ngày phát hành, sau ngày giao
    ISSUED_LATE: "Hoá đơn phát hành sau ngày giao (lập trễ).",
    unknown: "Hoá đơn có cảnh báo mới từ hệ thống — xem lại trước khi phát hành.",
  } satisfies Record<EInvoiceWarning | "unknown", string>,
  /** `rejectionCode` hệ thống tự ghi (không phải NCC từ chối) — câu thay cho "Nhà cung cấp từ chối". */
  /** Audit r3 EINV-3 (QĐ HĐ-1 bước 3): tra lại giao dịch cũ sau khi rút (BE `watchUntil` / `watchFoundAt`). */
  watch: {
    until: (day: string) => `Đang tra lại giao dịch cũ tới ngày ${day}.`,
    ended: (day: string) =>
      `Đã tra lại giao dịch cũ tới ngày ${day}: nhà cung cấp không phát hành giao dịch đó.`,
    found: (at: string) =>
      `Nhà cung cấp vẫn phát hành giao dịch cũ (phát hiện lúc ${at}) — kiểm tra trùng hoá đơn trên cổng nhà cung cấp trước khi phát hành lại.`,
  },
  rejections: {
    UNKNOWN_TO_PROVIDER: "Nhà cung cấp xác nhận không giữ hoá đơn này",
    // BE HĐ-1: Kế toán rút hoá đơn kẹt ở NCC; rejectionMessage = điều Kế toán đã kiểm tra
    WITHDRAWN_NO_PROVIDER_RECORD: "Đã rút khỏi nhà cung cấp (nhà cung cấp không có bản ghi)",
    // WF-05 Q-5: rejectionMessage = số phiếu / nội dung trả lời của hỗ trợ NCC; BE tự tra lại giao dịch cũ 30 ngày
    WITHDRAWN_RESULT_UNCONFIRMED:
      "Đã rút khỏi nhà cung cấp khi không xác nhận được kết quả (hệ thống tự tra lại giao dịch cũ trong 30 ngày) — văn bản của bộ phận hỗ trợ",
    // WF-05 Q-8: rejectionMessage = điều Kế toán đã kiểm trên cổng NCC
    REFUSED_BY_TAX_AUTHORITY: "Cơ quan thuế từ chối (Kế toán ghi lại từ cổng nhà cung cấp)",
  } satisfies Record<EInvoiceSystemRejectionCode, string>,
} as const;

/** Nhãn "Lập trễ N ngày" (WF-05 Q-1 / Q-10); không biết ngày giao → "Lập trễ". */
export function lateIssueLabel(days: number | null): string {
  return days != null && days > 0 ? `Lập trễ ${days} ngày` : "Lập trễ";
}
