import {
  DESIGN_QUOTE_REQUEST_LABELS as COPY,
  DESIGN_QUOTE_REQUEST_STATUS_LABELS,
} from "@/constants";

import type { LoadErrorCopy } from "@/components/backoffice/LoadErrorState";
import type { QuoteRequestStatus } from "../types";

export const QUOTE_REQUEST_COPY: LoadErrorCopy = {
  pageTitle: COPY.title,
  notFoundTitle: "Không tải được yêu cầu báo giá",
  notFoundDescription: "Hộp yêu cầu báo giá không tồn tại hoặc đường dẫn không hợp lệ.",
  forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền xem yêu cầu báo giá thiết kế.",
  noReadDescription: "Tài khoản của bạn chưa có quyền xem yêu cầu báo giá thiết kế.",
};

/**
 * Lựa chọn lọc trạng thái (cột "Trạng thái" của bảng "Bộ lọc" và lọc trên header cột), chung cho danh sách đơn lẻ và dự
 * án. BE nhận MỘT giá trị: chọn một, bỏ chọn = "Tất cả".
 */
export const QUOTE_REQUEST_STATUS_OPTIONS: readonly { value: QuoteRequestStatus; label: string }[] =
  (["OPEN", "CLOSED"] as const).map((value) => ({
    value,
    label: DESIGN_QUOTE_REQUEST_STATUS_LABELS[value] ?? value,
  }));
