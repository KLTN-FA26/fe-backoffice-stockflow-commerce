"use client";

import { Scale } from "lucide-react";

import { QUOTE_PRICE_REVIEW_LABELS } from "@/constants";
import { formatDecimal } from "@/lib/format";
import { DetailSection } from "@/components/shared/DetailSection";
import { Notice } from "@/components/shared/Notice";

import { PriceCheckTable } from "./PriceCheckTable";

import type { Quote } from "@/features/quote/types";

const L = QUOTE_PRICE_REVIEW_LABELS;

/**
 * Bậc giá so với giá tham chiếu trên trang báo giá (14 BR-10):
 * - nháp đang chờ duyệt → số liệu lúc gửi duyệt (`priceReview.lines`) — cái Quản lý kinh doanh duyệt;
 * - nháp chưa gửi duyệt → kiểm tra lúc này (`priceCheck`), kèm câu báo trước khi gửi sẽ phải chờ duyệt;
 * - đã gửi đi → số liệu của lần gửi duyệt gần nhất, nếu có.
 * Không có gì để so (BE không trả) thì không hiện mục này.
 */
export function QuotePriceReviewSection({ quote }: { quote: Quote }) {
  const draft = quote.status === "DRAFT";
  const review = quote.priceReview;
  // Chỉ lượt gửi duyệt của chính bản sửa đang xem: bản sau gửi thẳng thì không hiện số liệu của bản trước.
  const showReview =
    review != null &&
    review.revision === quote.revision &&
    (draft ? quote.priceReviewPending : true);
  const check = draft && !quote.priceReviewPending ? quote.priceCheck : null;
  if (!showReview && !check) return null;
  const lines = showReview && review ? review.lines : (check?.lines ?? []);
  const threshold = showReview && review ? review.thresholdPercent : (check?.thresholdPercent ?? 0);
  if (lines.length === 0) return null;
  return (
    <DetailSection
      title={showReview ? L.section.reviewTitle : L.section.checkTitle}
      icon={Scale}
      defaultOpen={draft}
    >
      <div className="space-y-3">
        {check?.needsApproval && <Notice tone="warning">{L.notice.willNeedApproval}</Notice>}
        <p className="text-ink-secondary text-xs">
          {L.section.threshold(formatDecimal(threshold, 2))}
        </p>
        <PriceCheckTable lines={lines} />
      </div>
    </DetailSection>
  );
}
