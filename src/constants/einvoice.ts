/**
 * Hoá đơn điện tử (docs ecommerce/21-e-invoice; BE module `invoicing`) — hằng số của màn Kế toán:
 * quyền, route, trạng thái, loại hoá đơn, căn cứ điều chỉnh, cảnh báo, giới hạn nhập liệu.
 * Tên trạng thái theo BE `EInvoiceStatus` (code là nguồn đúng; docs 21 §5.1 ghi `Failed` /
 * `Unknown` / `Cancelled` — BE dùng `REJECTED`, cờ `UNKNOWN_TO_PROVIDER`, `VOIDED_DRAFT`).
 */

/* ── Quyền (BE `InvoicingResources`, V20261120000300) ──────────────────────────────────── */

/**
 * Resource `einvoices` (seed V20261120000300): Kế toán và Quản trị đủ 6 action — CREATE (lập nháp từ
 * shipment đã giao, lập điều chỉnh / thay thế), UPDATE (sửa / huỷ / mở lại nháp, gắn thoả thuận),
 * APPROVE (phát hành, kiểm tra lại, gửi lại, gửi thông báo sai sót), EXPORT (bảng kê) — docs 21 BR-02;
 * Sales Manager chỉ VIEW_PAGE + READ. Sales Staff không có quyền (docs 21 §2 ghi Sale xem được hoá
 * đơn đơn mình — BE chưa cấp). Khách: READ, chỉ qua `/einvoices/me`.
 */
export const EINVOICE_PERMISSIONS = {
  viewPage: "einvoices:VIEW_PAGE",
  read: "einvoices:READ",
  create: "einvoices:CREATE",
  update: "einvoices:UPDATE",
  approve: "einvoices:APPROVE",
  export: "einvoices:EXPORT",
} as const;

/**
 * Resource `einvoice-settings` (không có VIEW_PAGE): Quản trị READ + UPDATE — nhà cung cấp, tài khoản,
 * ký hiệu, tự phát hành; Kế toán chỉ READ.
 */
export const EINVOICE_SETTINGS_PERMISSIONS = {
  read: "einvoice-settings:READ",
  update: "einvoice-settings:UPDATE",
} as const;

/* ── Route (BE `@PermissionResource route = /invoicing/...`) ───────────────────────────── */

const INVOICING_BASE = "/admin/invoicing";

export const EINVOICE_ROUTES = {
  list: `${INVOICING_BASE}/einvoices`,
  detail: (id: string) => `${INVOICING_BASE}/einvoices/${encodeURIComponent(id)}`,
  ofOrder: (orderId: string) =>
    `${INVOICING_BASE}/einvoices?orderId=${encodeURIComponent(orderId)}`,
  /** Hoá đơn chờ phát hành — mặc định của danh sách (docs 21 §4.1 bước 3). */
  pending: `${INVOICING_BASE}/einvoices?status=DRAFT`,
  register: `${INVOICING_BASE}/register`,
  settings: `${INVOICING_BASE}/settings`,
} as const;

/* ── Trạng thái, loại, căn cứ (BE enums) ─────────────────────────────────────────────── */

/** BE `EInvoiceStatus` (docs 21 §5.1). */
export const EINVOICE_STATUSES = [
  "DRAFT",
  "SUBMITTING",
  "ISSUED",
  "REJECTED",
  "VOIDED_DRAFT",
  "REPLACED",
] as const;
export type EInvoiceStatus = (typeof EINVOICE_STATUSES)[number];

/**
 * Giá trị enum BE mà FE chưa biết (BE thêm về sau) — DTO đọc tolerant thành chuỗi này thay vì làm hỏng
 * cả trang. Chỉ để hiển thị "Không rõ" và khoá mọi thao tác; KHÔNG bao giờ gửi lên BE.
 */
export const EINVOICE_UNKNOWN = "UNKNOWN";
export type EInvoiceUnknown = typeof EINVOICE_UNKNOWN;
/** Trạng thái như FE đọc được từ BE: một giá trị BE đã biết hoặc `UNKNOWN`. */
export type EInvoiceStatusRead = EInvoiceStatus | EInvoiceUnknown;

/** Chuỗi hiển thị qua `StatusDot` (domain `invoice`) — nhãn tiếng Việt ở `status-map`. */
export const EINVOICE_STATUS_BY_API = {
  DRAFT: "Draft",
  SUBMITTING: "Submitting",
  ISSUED: "Issued",
  REJECTED: "Rejected",
  VOIDED_DRAFT: "Voided Draft",
  REPLACED: "Replaced",
  UNKNOWN: "UNKNOWN",
} as const satisfies Record<EInvoiceStatusRead, string>;

/** BE `EInvoiceType`: gốc (mỗi shipment `Delivered`), điều chỉnh, thay thế (docs 21 §4.4). */
export const EINVOICE_TYPES = ["ORIGINAL", "ADJUSTMENT", "REPLACEMENT"] as const;
export type EInvoiceType = (typeof EINVOICE_TYPES)[number];
export type EInvoiceTypeRead = EInvoiceType | EInvoiceUnknown;

/**
 * BE `CorrectionBasis` (TT 91/2026 Điều 10): ERROR — sai mã số thuế / số lượng / giá / thuế suất / tiền,
 * cần thoả thuận bằng văn bản trước khi phát hành; RETURN — trả hàng (chỉ giảm); TRADE_DISCOUNT —
 * chiết khấu thương mại (chỉ giảm); DELIVERY_FAILED — giao hàng bị sửa thành thất bại sau khi hoá đơn
 * đã phát hành: hệ thống tự lập điều chỉnh giảm toàn bộ (docs 21 §4.4, WF-05 HĐ-3; BE PR #369).
 */
export const CORRECTION_BASES = ["ERROR", "RETURN", "TRADE_DISCOUNT", "DELIVERY_FAILED"] as const;
export type CorrectionBasis = (typeof CORRECTION_BASES)[number];
export type CorrectionBasisRead = CorrectionBasis | EInvoiceUnknown;

/**
 * Căn cứ Kế toán được chọn khi tự lập điều chỉnh. DELIVERY_FAILED chỉ hệ thống lập
 * (BE `CorrectionBasis.systemOnly()`, `EInvoiceCorrections` từ chối khi lập tay).
 */
export const MANUAL_CORRECTION_BASES = ["ERROR", "RETURN", "TRADE_DISCOUNT"] as const;
export type ManualCorrectionBasis = (typeof MANUAL_CORRECTION_BASES)[number];

/**
 * Căn cứ của hoá đơn giảm Kế toán làm trên cổng NCC rồi ghi vào hệ thống (BE G3 `external-reductions` `basis`, mặc
 * định DELIVERY_FAILED): giao thất bại, hoặc trả hàng trên hoá đơn thay thế (kèm `returnRequestId`).
 */
export const EXTERNAL_REDUCTION_BASES = ["DELIVERY_FAILED", "RETURN"] as const;
export type ExternalReductionBasis = (typeof EXTERNAL_REDUCTION_BASES)[number];

/**
 * Căn cứ của chứng từ do hệ thống tự lập (BE `CorrectionBasis.systemOnly()`): không lập tay, không huỷ
 * nháp tay (BE `EInvoice.voidDraft` → 409 `EINVOICE_CORRECTION_NOT_APPLICABLE`); văn bản chứng minh
 * giao thất bại được gắn kèm nhưng không bắt buộc (`acceptsAgreement()`).
 */
export const SYSTEM_CORRECTION_BASES: readonly string[] = ["DELIVERY_FAILED"];

/**
 * BE `EInvoice.Warning` + `EARLIER_INVOICE_PENDING` (chi tiết, `InvoicingWebMapper`). DTO đọc `warnings`
 * là chuỗi mở — giá trị ngoài danh sách hiện câu chung (`EINVOICE_LABELS.warnings.unknown`).
 */
export const EINVOICE_WARNINGS = [
  "BUYER_PROFILE_INCOMPLETE",
  "BUYER_EMAIL_MISSING",
  "TAX_RATE_DIFFERS_FROM_CONTRACT",
  "TAX_RATE_NOT_ON_CONTRACT",
  "TAX_RATE_OUT_OF_DATE",
  "TAX_EXEMPT_NOT_SUPPORTED",
  "UNKNOWN_TO_PROVIDER",
  "SIGNATURE_INVALID",
  "EARLIER_INVOICE_PENDING",
  // WF-05 Q-21: sản phẩm chưa gán nhóm thuế → tính mức cao nhất (10%); chặn tự phát hành
  "TAX_CLASS_UNKNOWN",
  // WF-05 Q-10 / §1.5 bước 6: phát hành sau ngày giao — BE thêm lúc gửi, không chặn gì
  "ISSUED_LATE",
] as const;

/** Cảnh báo "lập trễ" (BE thêm vào `warnings` lúc gửi, WF-05 Q-10) — nhãn "Lập trễ N ngày", bộ lọc danh sách. */
export const EINVOICE_LATE_WARNING = "ISSUED_LATE";

/**
 * Điều BE kiểm lại lúc phát hành tay mà KHÔNG lưu thành cảnh báo trên hoá đơn (`details.warnings` của 409
 * `EINVOICE_DRAFT_OUT_OF_DATE`, WF-05 BE-25 / F-16): hồ sơ pháp lý của khách nêu bên mua khác nháp
 * (BE `EInvoiceDrafts.BUYER_PROFILE_CHANGED`). Kế toán bấm "Làm mới bên mua" hoặc xác nhận rồi phát hành.
 */
export const EINVOICE_ISSUE_CHECKS = ["BUYER_PROFILE_CHANGED"] as const;
export type EInvoiceIssueCheck = (typeof EINVOICE_ISSUE_CHECKS)[number];

/**
 * `rejectionCode` do chính hệ thống ghi (BE `EInvoice.UNKNOWN_TO_PROVIDER_CODE`, `WITHDRAWN_CODE`) — không
 * phải NCC từ chối; mã khác là mã lỗi của NCC, hiện nguyên văn.
 */
export const EINVOICE_SYSTEM_REJECTION_CODES = [
  "UNKNOWN_TO_PROVIDER",
  "WITHDRAWN_NO_PROVIDER_RECORD",
  // WF-05 Q-5: rút hoá đơn không xác nhận được kết quả, có văn bản trả lời của hỗ trợ NCC (`rejectionMessage`)
  "WITHDRAWN_RESULT_UNCONFIRMED",
] as const;
export type EInvoiceSystemRejectionCode = (typeof EINVOICE_SYSTEM_REJECTION_CODES)[number];
export type EInvoiceWarning = (typeof EINVOICE_WARNINGS)[number];

/** Tệp của hoá đơn đã phát hành: XML (giá trị pháp lý) và PDF (bản xem, in) — docs 21 §1. */
export const EINVOICE_FILE_KINDS = ["XML", "PDF"] as const;
export type EInvoiceFileKind = (typeof EINVOICE_FILE_KINDS)[number];

/**
 * DỰ PHÒNG khi BE chưa gửi cờ `errorNoticeSupported` (hoá đơn) / `sendsErrorNotices` (NCC) — WF-05 F-11.
 * Nhà cung cấp gửi được thông báo sai sót 04/SS-HĐĐT (BE `EInvoiceProvider.sendsErrorNotices()`, HĐ-6):
 * chỉ `SANDBOX`. SePay (`SEPAY_EINVOICE`) không có API cho mẫu này, adapter Viettel (`VIETTEL_SINVOICE`)
 * không gửi → BE luôn trả 409 `EINVOICE_ERROR_NOTICE_NOT_SUPPORTED`; Kế toán lập trên cổng NCC / cơ quan thuế.
 */
export const ERROR_NOTICE_PROVIDERS: readonly string[] = ["SANDBOX"];

/** Mã NCC của BE (`EInvoiceProvider.code()`). */
export const EINVOICE_PROVIDER_CODES = {
  sandbox: "SANDBOX",
  sepay: "SEPAY_EINVOICE",
  viettel: "VIETTEL_SINVOICE",
} as const;

/**
 * DỰ PHÒNG khi BE chưa gửi cờ `accountInDeployment` (WF-05 F-11): NCC đọc tài khoản từ biến môi trường của máy chủ
 * (BE `SepayEInvoiceProvider.accountInDeployment()`) — BE từ chối lưu tài khoản qua màn cấu hình (400).
 */
export const DEPLOYMENT_ACCOUNT_PROVIDERS: readonly string[] = [EINVOICE_PROVIDER_CODES.sepay];

/**
 * Trạng thái chữ ký số trên XML (BE `EInvoiceSignatureResponse.status`): VALID; CONTENT_CHANGED (ký rồi bị sửa);
 * SIGNATURE_INVALID; NOT_SIGNED (sandbox không ký); UNREADABLE (không phải XML); SHA1_UNCHECKED (ký SHA-1 — chưa
 * kiểm được, không phải chữ ký sai; WF-05 BE-56 / F-18).
 */
export const SIGNATURE_STATUSES = [
  "VALID",
  "CONTENT_CHANGED",
  "SIGNATURE_INVALID",
  "NOT_SIGNED",
  "UNREADABLE",
  "SHA1_UNCHECKED",
] as const;
export type SignatureStatus = (typeof SIGNATURE_STATUSES)[number];

/**
 * Trạng thái câu trả lời của NCC khi BE từ chối rút hoá đơn (`details.providerState`, WF-05 F-12 / BE-59).
 * UNCONFIRMED: không xác nhận được kết quả — rút chỉ khi có văn bản của bộ phận hỗ trợ NCC (Q-5).
 */
export const WITHDRAWAL_PROVIDER_STATES = [
  "PENDING",
  "UNKNOWN",
  "NOT_FOUND",
  "UNCONFIRMED",
] as const;
export type WithdrawalProviderState = (typeof WITHDRAWAL_PROVIDER_STATES)[number];

/** Kết quả Kế toán ghi lại từ cổng NCC cho hoá đơn kẹt "đang gửi" (WF-05 Q-8, F-13). */
export const PORTAL_RESULT_OUTCOMES = ["ISSUED", "REFUSED_BY_TAX_AUTHORITY"] as const;
export type PortalResultOutcome = (typeof PORTAL_RESULT_OUTCOMES)[number];

/** Hoá đơn ghi lại từ cổng NCC, không phát hành qua API (BE `EInvoiceResponse.issuedVia`, WF-05 F-13). */
export const EINVOICE_ISSUED_VIA_PORTAL = "PORTAL_RECORD";

/** Mã lý do huỷ bản giảm do giao thất bại không gửi được qua NCC (BE `void` `reasonCode`, WF-05 Q-8 / F-14). */
export const UNSENDABLE_REVERSAL_REASON_CODE = "UNSENDABLE_REVERSAL";

/** BE `ErrorNotice.Subject` / `Status` — thông báo sai sót mẫu 04/SS-HDDT. */
export const ERROR_NOTICE_SUBJECTS = ["BUYER_NAME_ADDRESS", "WITH_CORRECTION"] as const;
export const ERROR_NOTICE_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED"] as const;

/** BE `ProviderCallLog.Operation` / `Outcome` — nhật ký gọi nhà cung cấp (docs 21 §3 Output). */
export const PROVIDER_CALL_OPERATIONS = ["SUBMIT", "QUERY", "DOWNLOAD", "NOTICE"] as const;
export const PROVIDER_CALL_OUTCOMES = [
  "ACCEPTED",
  "DUPLICATE",
  "PENDING",
  "ISSUED",
  "REJECTED",
  "NOT_FOUND",
  "DOWNLOADED",
  "TIMEOUT",
  "ERROR",
  "NOT_SUPPORTED",
] as const;

/** Môi trường tài khoản nhà cung cấp (BE `StoreEInvoiceProviderAccountRequest`, docs 21 BR-10). */
export const PROVIDER_ENVIRONMENTS = ["SANDBOX", "PRODUCTION"] as const;

/* ── Giới hạn (BE request DTO) ────────────────────────────────────────────────────────── */

export const EINVOICE_LIMITS = {
  reasonMax: 500,
  buyerNameMax: 200,
  buyerTaxCodeMax: 20,
  buyerAddressMax: 500,
  buyerEmailMax: 320,
  lineNameMax: 500,
  linesMax: 200,
  /** Số văn bản thoả thuận ≤ 64 ký tự, ngày không ở tương lai, tệp PDF (BE `EInvoice.attachAgreement`). */
  agreementNumberMax: 64,
  /** Ký hiệu hoá đơn: C/K + 2 số năm + loại + 2 chữ (BE `UseEInvoiceSeriesRequest`). */
  symbolPattern: /^[CK][0-9]{2}[TDLMNBGHXF][A-Z]{2}$/,
  /** Mã số thuế: 10 số, 10-3 hoặc 12 số (docs 18 BR-01, 21 BR-06). */
  taxCodePattern: /^(\d{10}|\d{10}-\d{3}|\d{12})$/,
  yearMin: 2026,
  yearMax: 2099,
  /** Số phiếu / nội dung trả lời của hỗ trợ NCC khi rút hoá đơn không xác nhận được (WF-05 F-12). */
  supportReferenceMax: 200,
  /** Ghi chú khi ghi kết quả từ cổng NCC (WF-05 F-13) — cùng cột lý do. */
  noteMax: 500,
  /** Mã cơ quan thuế / mã tra cứu ghi từ cổng NCC. */
  providerCodeMax: 64,
} as const;

/**
 * Mốc thời gian của BE `InvoicingProperties` (application.yml `stockflow.invoicing.*`, BE PR #369) — CHỈ mock dùng.
 * FE không tự tính đồng hồ rút: BE trả mốc thật trong `details.withdrawableFrom` của 409 `EINVOICE_WITHDRAWAL_REFUSED`.
 */
export const EINVOICE_TIMING = {
  /** `withdraw-after` (3 giờ): rút được hoá đơn kẹt ở NCC khi lần gửi cuối đã quá mốc này và NCC không có bản ghi. */
  withdrawAfterMs: 3 * 60 * 60 * 1000,
  /** `withdraw-unknown-after` (1 ngày): NCC "không trả lời được" (UNKNOWN) thì phải chờ lâu hơn. */
  withdrawUnknownAfterMs: 24 * 60 * 60 * 1000,
} as const;

export const EINVOICE_STORAGE_KEYS = {
  listConfig: "stockflow:admin:invoicing:einvoices:config",
} as const;
