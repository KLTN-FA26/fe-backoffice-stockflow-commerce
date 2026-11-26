import { Hourglass } from "lucide-react";

import { QUOTE_PRICE_REVIEW_LABELS } from "@/constants";

/**
 * "Chờ duyệt giá" (14 BR-10): báo giá vẫn là Nháp nhưng đang chờ Quản lý kinh doanh duyệt giá. Ghi bằng chữ kèm icon
 * (WCAG 1.4.1 — không chỉ đổi màu), như "Hết hiệu lực" của danh sách.
 */
export function PriceReviewBadge() {
  return (
    <span className="text-ink-primary inline-flex items-center gap-1 text-xs font-medium">
      <Hourglass className="text-dot-warning size-3.5" aria-hidden="true" />
      {QUOTE_PRICE_REVIEW_LABELS.badge}
    </span>
  );
}
