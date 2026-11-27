/** Nhãn riêng của trang "Đơn chờ duyệt công nợ" (bo-21) — nhãn chung của đơn vẫn ở `UI_LABELS.order`. */

/** Hai hàng chờ của trang, tab trên URL (`?tab=`). */
export const CREDIT_REVIEW_TABS = ["orders", "contracts"] as const;
export type CreditReviewTab = (typeof CREDIT_REVIEW_TABS)[number];

export const CREDIT_HOLD_COPY = {
  tabs: {
    orders: "Đơn chờ duyệt",
    contracts: "Hợp đồng chờ duyệt trước khi gửi",
  } satisfies Record<CreditReviewTab, string>,
  approve: "Duyệt",
  approveLabel: (orderNumber: string) => `Duyệt công nợ — ${orderNumber}`,
  overLimit: "Vượt hạn mức",
  overdue: "Khách có công nợ quá hạn",
  overdueDays: (days: number) => `quá hạn ${days} ngày`,
  overdueCleared: "Hiện không còn quá hạn",
  loading: "Đang tải…",
} as const;
