import { QUOTE_STATUS_LABELS } from "@/constants";

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
