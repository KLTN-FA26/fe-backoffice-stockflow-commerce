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
 * APPROVE (phát hành, tra lại, gửi lại, gửi thông báo sai sót), EXPORT (bảng kê) — docs 21 BR-02;
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

/** Chuỗi hiển thị qua `StatusDot` (domain `invoice`) — nhãn tiếng Việt ở `status-map`. */
export const EINVOICE_STATUS_BY_API = {
  DRAFT: "Draft",
  SUBMITTING: "Submitting",
  ISSUED: "Issued",
  REJECTED: "Rejected",
  VOIDED_DRAFT: "Voided Draft",
  REPLACED: "Replaced",
} as const satisfies Record<EInvoiceStatus, string>;

/** BE `EInvoiceType`: gốc (mỗi shipment `Delivered`), điều chỉnh, thay thế (docs 21 §4.4). */
export const EINVOICE_TYPES = ["ORIGINAL", "ADJUSTMENT", "REPLACEMENT"] as const;
export type EInvoiceType = (typeof EINVOICE_TYPES)[number];

/**
 * BE `CorrectionBasis` (TT 91/2026 Điều 10): ERROR — sai mã số thuế / số lượng / giá / thuế suất / tiền,
 * cần thoả thuận bằng văn bản trước khi phát hành; RETURN — trả hàng (chỉ giảm); TRADE_DISCOUNT —
 * chiết khấu thương mại (chỉ giảm).
 */
export const CORRECTION_BASES = ["ERROR", "RETURN", "TRADE_DISCOUNT"] as const;
export type CorrectionBasis = (typeof CORRECTION_BASES)[number];

/** BE `EInvoice.Warning` + `EARLIER_INVOICE_PENDING` (chi tiết). */
export const EINVOICE_WARNINGS = [
  "BUYER_PROFILE_INCOMPLETE",
  "TAX_RATE_DIFFERS_FROM_CONTRACT",
  "TAX_RATE_NOT_ON_CONTRACT",
  "UNKNOWN_TO_PROVIDER",
  "EARLIER_INVOICE_PENDING",
] as const;
export type EInvoiceWarning = (typeof EINVOICE_WARNINGS)[number];

/** Tệp của hoá đơn đã phát hành: XML (giá trị pháp lý) và PDF (bản xem, in) — docs 21 §1. */
export const EINVOICE_FILE_KINDS = ["XML", "PDF"] as const;
export type EInvoiceFileKind = (typeof EINVOICE_FILE_KINDS)[number];

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
} as const;

export const EINVOICE_STORAGE_KEYS = {
  listConfig: "stockflow:admin:invoicing:einvoices:config",
} as const;
