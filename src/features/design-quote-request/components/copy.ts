import { DESIGN_QUOTE_REQUEST_LABELS as COPY } from "@/constants";

import type { LoadErrorCopy } from "@/components/backoffice/LoadErrorState";

export const QUOTE_REQUEST_COPY: LoadErrorCopy = {
  pageTitle: COPY.title,
  notFoundTitle: "Không tải được yêu cầu báo giá",
  notFoundDescription: "Hộp yêu cầu báo giá không tồn tại hoặc đường dẫn không hợp lệ.",
  forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền xem yêu cầu báo giá thiết kế.",
  noReadDescription: "Tài khoản của bạn chưa có quyền xem yêu cầu báo giá thiết kế.",
};
