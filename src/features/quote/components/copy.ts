import { STATUS_LABEL_VI } from "@/lib/domain/status-map";
import { QUOTE_STATUS_BY_API } from "@/constants";

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
  const key = QUOTE_STATUS_BY_API[status];
  return STATUS_LABEL_VI[key] ?? key;
}

export const MONO = "font-[family-name:var(--font-mono)] text-[0.8125rem] tabular-nums";
