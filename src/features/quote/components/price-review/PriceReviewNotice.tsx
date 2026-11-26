"use client";

import { QUOTE_PRICE_REVIEW_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { Notice } from "@/components/shared/Notice";

import type { Quote } from "@/features/quote/types";

const N = QUOTE_PRICE_REVIEW_LABELS.notice;

/**
 * Kết quả lần gửi duyệt giá gần nhất (14 BR-10): đang chờ (ai gửi, lúc nào), đã duyệt (ai, lúc nào, ghi chú), bị từ
 * chối (ai, lúc nào, lý do), đã rút lại. Lần duyệt thuộc bản sửa trước không hiện (bản sửa mới đo lại từ đầu).
 */
export function PriceReviewNotice({ quote }: { quote: Quote }) {
  const review = quote.priceReview;
  if (!review || review.revision !== quote.revision) return null;
  const submittedBy = review.submittedByName ?? N.someone;
  const decidedBy = review.decidedByName ?? N.someone;
  const decidedAt = review.decidedAt ? formatDateTime(review.decidedAt) : "—";
  const reason = review.reason ? (
    <span className="mt-1 block">
      <strong>{review.outcome === "APPROVED" ? N.note : N.reason}</strong>{" "}
      <span className="whitespace-pre-line">{review.reason}</span>
    </span>
  ) : null;
  switch (review.outcome) {
    case "PENDING":
      // Chỉ khi báo giá thật sự đang chờ (BE giữ cờ trên báo giá); lệch thì tin cờ của báo giá
      return quote.priceReviewPending ? (
        <Notice tone="info">{N.pending(submittedBy, formatDateTime(review.submittedAt))}</Notice>
      ) : null;
    case "APPROVED":
      return (
        <Notice tone="positive">
          {N.approved(decidedBy, decidedAt)}
          {reason}
        </Notice>
      );
    case "REJECTED":
      return (
        <Notice tone="danger">
          {N.rejected(decidedBy, decidedAt)}
          {reason}
        </Notice>
      );
    case "WITHDRAWN":
      return (
        <Notice tone="info">
          {N.withdrawn(decidedAt)}
          {reason}
        </Notice>
      );
  }
}
