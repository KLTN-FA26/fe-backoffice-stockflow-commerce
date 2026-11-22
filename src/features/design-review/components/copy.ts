import { DESIGN_REVIEW_LABELS, DESIGN_ROUND_LABELS } from "@/constants";

import type { LoadErrorCopy } from "@/components/backoffice/LoadErrorState";

/** BE V20261213000200: `design-designs:APPROVE` chuyển từ Quản lý bán hàng sang Điều phối sản xuất. */
const REVIEWER_ONLY = "Chỉ Điều phối sản xuất được duyệt thiết kế của khách.";

export const REVIEW_QUEUE_COPY: LoadErrorCopy = {
  pageTitle: DESIGN_REVIEW_LABELS.queueTitle,
  notFoundTitle: "Không tải được hàng đợi",
  notFoundDescription: "Hàng đợi duyệt thiết kế không tồn tại hoặc đường dẫn không hợp lệ.",
  forbiddenDescription: REVIEWER_ONLY,
  noReadDescription: "Tài khoản của bạn chưa có quyền duyệt thiết kế.",
};

/** 404 khi mở chi tiết = thiết kế không còn chờ duyệt (BE ẩn thiết kế đã quyết định khỏi người duyệt). */
export const DESIGN_DETAIL_COPY: LoadErrorCopy = {
  pageTitle: "Thiết kế của khách",
  notFoundTitle: DESIGN_REVIEW_LABELS.notFoundTitle,
  notFoundDescription: DESIGN_REVIEW_LABELS.notFoundDescription,
  forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền xem thiết kế của khách.",
  noReadDescription:
    "Bạn được mở trang nhưng chưa có quyền xem thiết kế. Liên hệ quản trị để được cấp.",
};

export const MONO = "font-[family-name:var(--font-mono)] text-[0.8125rem] tabular-nums";

/** Ảnh xem trước khách gửi luôn là PNG (storefront `studio/submission-bundle.ts`); `previewUrl` không kèm kiểu file. */
export const PREVIEW_CONTENT_TYPE = "image/png";

export const REVIEW_ROUNDS_COPY: LoadErrorCopy = {
  pageTitle: DESIGN_ROUND_LABELS.listTitle,
  notFoundTitle: DESIGN_ROUND_LABELS.notFoundTitle,
  notFoundDescription: DESIGN_ROUND_LABELS.notFoundDescription,
  forbiddenDescription: REVIEWER_ONLY,
  noReadDescription: "Tài khoản của bạn chưa có quyền duyệt thiết kế.",
};
