/**
 * Duyệt giá báo giá (kltn-docs 14 BR-10 sửa ngày 2026-11-26; BE `QuotePriceCheck`, `QuotePriceReviews`). Khi Sales gửi,
 * từng bậc giá của từng dòng được so với giá tham chiếu: giá riêng của khách cho SKU, không có thì giá chuẩn của quy cách
 * SKU được làm từ đó. Có bậc thấp hơn giá tham chiếu quá ngưỡng (mặc định 10%) hoặc không có giá tham chiếu → báo giá
 * không gửi khách mà ở lại Nháp, chờ Quản lý kinh doanh duyệt; người gửi duyệt không tự duyệt được. Giá cao hơn giá tham
 * chiếu không cần duyệt; phí khuôn / phí vận chuyển không tính.
 */

import { QUOTE_PRICE_REVIEW_LIMITS } from "./numbers";

/** BE `QuoteResponse.PriceReview.outcome`. */
export const QUOTE_PRICE_REVIEW_OUTCOMES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
] as const;
export type QuotePriceReviewOutcome = (typeof QUOTE_PRICE_REVIEW_OUTCOMES)[number];

/** BE `QuotePriceCheck.Source` — nguồn của giá tham chiếu một bậc. */
export const QUOTE_PRICE_SOURCES = ["CUSTOMER_PRICE", "STANDARD_PRICE"] as const;
export type QuotePriceSource = (typeof QUOTE_PRICE_SOURCES)[number];

export const QUOTE_PRICE_REVIEW_LABELS = {
  badge: "Chờ duyệt giá",
  filter: "Chờ duyệt giá",
  filterSummary: "Duyệt giá",
  filterAll: "Tất cả",
  outcome: {
    PENDING: "Chờ duyệt giá",
    APPROVED: "Đã duyệt giá",
    REJECTED: "Giá bị từ chối",
    WITHDRAWN: "Đã rút lại yêu cầu duyệt",
  } satisfies Record<QuotePriceReviewOutcome, string>,
  source: {
    CUSTOMER_PRICE: "Giá riêng của khách",
    STANDARD_PRICE: "Giá chuẩn",
  } satisfies Record<QuotePriceSource, string>,
  noReference: "Chưa có giá tham chiếu",
  section: {
    checkTitle: "Kiểm tra giá",
    reviewTitle: "Giá gửi duyệt",
    caption: "Bậc giá so với giá tham chiếu",
    lineHeader: "Dòng",
    tierHeader: "Từ (thùng)",
    priceHeader: "Đơn giá",
    referenceHeader: "Giá tham chiếu",
    sourceHeader: "Nguồn",
    discountHeader: "Thấp hơn",
    statusHeader: "Duyệt",
    needsApproval: "Cần duyệt",
    ok: "Đạt",
    cartons: (cartons: number) => `${cartons.toLocaleString("vi-VN")} thùng`,
    threshold: (percent: string) =>
      `Bậc giá thấp hơn giá tham chiếu quá ${percent}%, hoặc chưa có giá tham chiếu, cần Quản lý kinh doanh duyệt. Giá cao hơn giá tham chiếu không cần duyệt.`,
    above: (percent: string) => `cao hơn ${percent}%`,
  },
  notice: {
    willNeedApproval:
      "Có bậc giá thấp hơn giá tham chiếu quá ngưỡng hoặc chưa có giá tham chiếu: khi gửi, báo giá sẽ chuyển Quản lý kinh doanh duyệt giá thay vì gửi khách.",
    pending: (by: string, at: string) =>
      `Đang chờ Quản lý kinh doanh duyệt giá — ${by} gửi duyệt lúc ${at}. Khách chưa thấy báo giá này.`,
    approved: (by: string, at: string) => `Giá đã được ${by} duyệt lúc ${at}.`,
    rejected: (by: string, at: string) => `Giá bị ${by} từ chối lúc ${at}.`,
    withdrawn: (at: string) => `Yêu cầu duyệt giá đã được rút lại lúc ${at}.`,
    reason: "Lý do:",
    note: "Ghi chú:",
    self: "Bạn là người gửi duyệt báo giá này — người khác duyệt hoặc từ chối giá.",
    someone: "một người",
  },
  action: {
    sendForApproval: "Gửi duyệt giá",
    withdraw: "Rút lại",
    approve: "Duyệt giá",
    reject: "Từ chối",
  },
  sendDialog: {
    approvalTitle: "Gửi Quản lý kinh doanh duyệt giá?",
    approvalDescription:
      "Có bậc giá thấp hơn giá tham chiếu quá ngưỡng hoặc chưa có giá tham chiếu. Báo giá chưa đến khách: Quản lý kinh doanh duyệt thì báo giá được gửi khách ngay; từ chối thì báo giá trở về nháp để sửa. Trong lúc chờ không sửa được báo giá.",
    approvalConfirm: "Gửi duyệt giá",
  },
  withdrawDialog: {
    title: "Rút lại yêu cầu duyệt giá?",
    description: "Báo giá trở về nháp để sửa. Muốn gửi lại thì bấm gửi như bình thường.",
    confirm: "Rút lại",
  },
  approveDialog: {
    title: "Duyệt giá báo giá?",
    description:
      "Báo giá được gửi cho khách ngay sau khi duyệt. Ghi chú (không bắt buộc) gửi kèm cho Sales.",
    noteLabel: "Ghi chú cho Sales",
    confirm: "Duyệt giá",
  },
  rejectDialog: {
    title: "Từ chối giá báo giá?",
    description: "Báo giá trở về nháp để Sales sửa giá rồi gửi lại.",
    reasonLabel: "Lý do từ chối",
    reasonRequired: "Nhập lý do từ chối giá",
    confirm: "Từ chối giá",
  },
  toast: {
    sentForApproval: "Đã gửi Quản lý kinh doanh duyệt giá.",
    sentToCustomer: "Đã gửi báo giá cho khách.",
    approved: "Đã duyệt giá — báo giá đã gửi cho khách.",
    rejected: "Đã từ chối giá — báo giá trở về nháp.",
    withdrawn: "Đã rút lại yêu cầu duyệt giá.",
  },
  nextStep: {
    pending: "Chờ Quản lý kinh doanh duyệt giá. Cần sửa thì Rút lại.",
    pendingApprover:
      "Báo giá chờ bạn duyệt giá — xem bảng kiểm tra giá rồi Duyệt giá hoặc Từ chối.",
  },
  noteTooLong: `Tối đa ${QUOTE_PRICE_REVIEW_LIMITS.noteMax} ký tự`,
} as const;
