/**
 * Đề nghị cấp hạn mức (kltn-docs 15 §4.3 bước 9–11a, 18 §4.1 bước 5; BE `CreditRequestController`, PR #490). File
 * riêng, import thẳng `@/constants/credit-request`.
 */

/**
 * Resource `customer-credit-requests` (BE seed V20270102000100): VIEW_PAGE Sale / QLKD / Kế toán / Admin; CREATE Sale /
 * QLKD / Admin (và khách cho mình); UPDATE (ghi ý kiến) Sale / QLKD / Admin; APPROVE (duyệt, từ chối) Kế toán / Admin.
 */
export const CREDIT_REQUEST_PERMISSIONS = {
  viewPage: "customer-credit-requests:VIEW_PAGE",
  read: "customer-credit-requests:READ",
  create: "customer-credit-requests:CREATE",
  update: "customer-credit-requests:UPDATE",
  approve: "customer-credit-requests:APPROVE",
} as const;

/** BE `CreditRequestStatus` — nguyên văn. */
export const CREDIT_REQUEST_API_STATUSES = [
  "SUBMITTED",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
] as const;
export type CreditRequestApiStatus = (typeof CREDIT_REQUEST_API_STATUSES)[number];

/** Khoá hiển thị cho status-map (Title Case 1-1 với enum BE); giá trị lạ → `UNKNOWN`. */
export const CREDIT_REQUEST_STATUS_BY_API = {
  SUBMITTED: "Submitted",
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  UNKNOWN: "UNKNOWN",
} as const satisfies Record<CreditRequestApiStatus | "UNKNOWN", string>;

/** Còn mở (BE `CreditRequestStatus.open`) — mỗi khách tối đa một đề nghị như vậy. */
export const CREDIT_REQUEST_OPEN_STATUSES = [
  "SUBMITTED",
  "PENDING_APPROVAL",
] as const satisfies readonly CreditRequestApiStatus[];

/** Cảnh báo của khối số liệu xét (chỉ cảnh báo, không chặn Duyệt). */
export const CREDIT_REQUEST_WARNING_LABELS: Readonly<Record<string, string>> = {
  SHORT_HISTORY: "Khách có ít hợp đồng đã trả đủ",
  ABOVE_SUGGESTED: "Mức xin cao hơn mức gợi ý",
  OVERDUE: "Khách đang có khoản quá hạn",
};

/** Giới hạn BE (`CreditRequestRequests`): chữ ≤ 1000; kỳ hạn 0–365 ngày; tệp ≤ 10, mỗi tệp ≤ 25 MB. */
export const CREDIT_REQUEST_LIMITS = {
  textMax: 1000,
  termDaysMax: 365,
  filesMax: 10,
  fileBytesMax: 25 * 1024 * 1024,
  /** PDF, Word, Excel, JPEG, PNG. */
  accept: ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png",
} as const;

const BASE = "/admin/payment/credit-requests";

/** Route khớp link thông báo BE (`/admin/payment/credit-requests/{id}`). */
export const CREDIT_REQUEST_ROUTES = {
  list: BASE,
  detail: (id: string) => `${BASE}/${encodeURIComponent(id)}`,
  /** Lối Sale tạo đề nghị thay khách từ trang khách (A2): mở form tạo với khách điền sẵn. */
  createFor: (customerId: string) => `${BASE}?create=${encodeURIComponent(customerId)}`,
  byCustomer: (customerId: string) => `${BASE}?customerId=${encodeURIComponent(customerId)}`,
} as const;

export const CREDIT_REQUEST_STORAGE_KEYS = {
  listConfig: "stockflow:admin:payment:credit-requests:config",
} as const;

export const CREDIT_REQUEST_LABELS = {
  navLabel: "Đề nghị cấp hạn mức",
  pageTitle: "Đề nghị cấp hạn mức",
  createAction: "Tạo đề nghị",
  createTooltip: "Tạo đề nghị cấp hạn mức thay khách",
  emptyTitle: "Chưa có đề nghị cấp hạn mức",
  emptyDescription: "Khách gửi từ cổng hoặc Sale tạo thay khách sẽ hiện ở đây.",
  notFoundTitle: "Không tìm thấy đề nghị",
  notFoundDescription: "Đề nghị không tồn tại hoặc đường dẫn không hợp lệ.",
  forbiddenDescription: "Bạn không có quyền xem đề nghị cấp hạn mức.",
  noReadDescription: "Tài khoản của bạn chưa được cấp quyền đọc đề nghị cấp hạn mức.",
  source: { PORTAL: "Khách gửi", SALES: "Sale gửi thay" } as Readonly<Record<string, string>>,
} as const;
