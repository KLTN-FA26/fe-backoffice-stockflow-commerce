/**
 * Chuyển khoản tự ghi nhận qua SePay (kế hoạch tín dụng 2026-11-26 phần C; BE `BankTransactionController`, PR #490):
 * hàng chờ của Kế toán. File riêng, import thẳng `@/constants/bank-transaction`.
 */

/** Resource `payment-bank-transactions` (BE seed V20270103000100): chỉ Kế toán và Admin. */
export const BANK_TRANSACTION_PERMISSIONS = {
  viewPage: "payment-bank-transactions:VIEW_PAGE",
  read: "payment-bank-transactions:READ",
  update: "payment-bank-transactions:UPDATE",
} as const;

/** BE `BankTransactionStatus` — nguyên văn. */
export const BANK_TRANSACTION_API_STATUSES = [
  "RECEIVED",
  "APPLIED",
  "NEEDS_REVIEW",
  "IGNORED",
] as const;
export type BankTransactionApiStatus = (typeof BANK_TRANSACTION_API_STATUSES)[number];

/** Khoá hiển thị cho status-map (Title Case 1-1 với enum BE). */
export const BANK_TRANSACTION_STATUS_BY_API = {
  RECEIVED: "Received",
  APPLIED: "Applied",
  NEEDS_REVIEW: "Needs Review",
  IGNORED: "Ignored",
  UNKNOWN: "UNKNOWN",
} as const satisfies Record<BankTransactionApiStatus | "UNKNOWN", string>;

/** Tab: "Chờ xử lý" mặc định, "Tất cả" (không gửi `status`). */
export const BANK_TRANSACTION_TABS = ["review", "all"] as const;
export type BankTransactionTab = (typeof BANK_TRANSACTION_TABS)[number];

/** Bản dịch `reviewReason` (handoff C). Mã lạ hiện nguyên mã. */
export const BANK_TRANSACTION_REVIEW_REASONS: Readonly<Record<string, string>> = {
  NO_INSTALLMENT_NAMED: "Nội dung không có mã hợp đồng và mã đợt",
  SEVERAL_INSTALLMENTS: "Nội dung nhắc nhiều đợt, hoặc không rõ là hợp đồng nào",
  INSTALLMENT_NOT_FOUND: "Không tìm thấy đợt theo mã trong nội dung",
  NOT_PAYABLE: "Đợt đã trả đủ hoặc đã huỷ, hoặc đơn đã huỷ",
  OVERPAYMENT: "Số tiền lớn hơn số còn phải thu của đợt",
  OTHER_ACCOUNT: "Tiền vào tài khoản khác với tài khoản nhận",
  REFUSED: "Không lập được phiếu thu (xem chi tiết)",
  RECEIPT_VOIDED: "Phiếu thu lập từ giao dịch này đã bị huỷ, cần gán lại hoặc bỏ qua",
};

/** Ghi chú khi gán / lý do bỏ qua ≤ 500 ký tự; tối đa 100 dòng gán (BE `AssignBankTransactionRequest`). */
export const BANK_TRANSACTION_LIMITS = { noteMax: 500, linesMax: 100 } as const;

/**
 * Tài khoản hệ thống "Bank feed (SePay)" (BE `BankFeedUser.ID`, V20270103000100): phiếu thu có `recordedBy` này là phiếu
 * hệ thống tự lập → nhãn "Tự động".
 */
export const BANK_FEED_USER_ID = "0193c000-0000-7000-8000-00000000bf01";

const BASE = "/admin/payment/bank-transactions";

export const BANK_TRANSACTION_ROUTES = {
  list: BASE,
  detail: (id: string) => `${BASE}/${encodeURIComponent(id)}`,
} as const;

export const BANK_TRANSACTION_STORAGE_KEYS = {
  listConfig: "stockflow:admin:payment:bank-transactions:config",
} as const;

export const BANK_TRANSACTION_LABELS = {
  navLabel: "Giao dịch ngân hàng",
  pageTitle: "Giao dịch ngân hàng",
  tabs: { review: "Chờ xử lý", all: "Tất cả" } satisfies Record<BankTransactionTab, string>,
  emptyReviewTitle: "Không có giao dịch chờ xử lý",
  emptyReviewDescription: "Chuyển khoản đúng nội dung được hệ thống tự lập phiếu thu.",
  emptyAllTitle: "Chưa có giao dịch ngân hàng",
  emptyAllDescription: "Giao dịch SePay báo về sẽ hiện ở đây.",
  notFoundTitle: "Không tìm thấy giao dịch ngân hàng",
  notFoundDescription: "Giao dịch không tồn tại hoặc đường dẫn không hợp lệ.",
  forbiddenDescription: "Bạn không có quyền xem giao dịch ngân hàng.",
  noReadDescription: "Tài khoản của bạn chưa được cấp quyền đọc giao dịch ngân hàng.",
  automatic: "Tự động",
  automaticTitle: "Hệ thống tự lập từ chuyển khoản (Bank feed SePay)",
} as const;
