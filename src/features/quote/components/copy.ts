import { QUOTE_STATUS_BY_API, QUOTE_STATUS_LABELS } from "@/constants";

import type { QuoteApiStatus } from "@/constants";
import type { LoadErrorCopy } from "@/components/backoffice/LoadErrorState";

export const QUOTE_COPY: LoadErrorCopy = {
  pageTitle: "Báo giá",
  notFoundTitle: "Không tìm thấy báo giá",
  notFoundDescription: "Báo giá không tồn tại, đã bị huỷ hoặc đường dẫn không hợp lệ.",
  forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền xem báo giá.",
  noReadDescription:
    "Bạn được mở trang nhưng chưa có quyền xem dữ liệu báo giá. Liên hệ quản trị để được cấp.",
};

export function quoteStatusLabel(status: QuoteApiStatus): string {
  return QUOTE_STATUS_LABELS[status];
}

/**
 * Khoá màu (`StatusDot`) của trạng thái báo giá. "Yêu cầu sửa" là việc Sale cần làm tiếp (mở bản sửa), không phải lỗi:
 * cam "cần xử lý" như "Waiting on Internal", không đỏ (rà UI WF-02 bo-06).
 */
export const QUOTE_STATUS_TONE_KEY = {
  ...QUOTE_STATUS_BY_API,
  CHANGES_REQUESTED: "Waiting on Internal",
} as const satisfies Record<QuoteApiStatus, string>;

export const MONO = "font-[family-name:var(--font-mono)] text-[0.8125rem] tabular-nums";

/** Nhãn của danh sách báo giá. */
export const QUOTE_LIST_LABELS = {
  number: "Số báo giá",
  customer: "Khách hàng",
  status: "Trạng thái",
  total: "Tổng có thuế",
  validUntil: "Hiệu lực đến",
  sentAt: "Ngày gửi",
  order: "Đơn đã tạo",
  openOrder: "Mở đơn",
  notPriced: "Chưa đủ giá",
  expired: "Hết hiệu lực",
  revision: (revision: number) => `b${revision}`,
  moreLines: (count: number) => `+${count} dòng`,
} as const;

/** Tab nhanh theo trạng thái trên danh sách báo giá (bo-06). */
export const QUOTE_LIST_TABS = {
  ariaLabel: "Lọc nhanh theo trạng thái",
  all: "Tất cả",
  DRAFT: "Nháp",
  priceReview: "Chờ duyệt giá",
  SENT: "Đã gửi",
  CHANGES_REQUESTED: "Khách yêu cầu sửa",
  ACCEPTED: "Đã chấp nhận",
  CONVERTED: "Đã tạo đơn",
} as const;

/** Hàng chờ "Chờ duyệt giá" rỗng (bo-14): câu của hàng chờ, không phải câu "không khớp từ khoá". */
export const QUOTE_PRICE_REVIEW_QUEUE_EMPTY = {
  title: "Không có báo giá nào chờ duyệt giá",
  description: "Báo giá Sale gửi duyệt giá sẽ hiện ở đây để Quản lý kinh doanh duyệt hoặc từ chối.",
} as const;
