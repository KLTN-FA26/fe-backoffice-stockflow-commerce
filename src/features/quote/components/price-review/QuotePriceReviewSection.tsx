"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, Scale } from "lucide-react";

import { QUOTE_PRICE_REVIEW_LABELS } from "@/constants";
import { formatDecimal } from "@/lib/format";
import { DetailSection } from "@/components/shared/DetailSection";
import { Notice } from "@/components/shared/Notice";
import { Button } from "@/components/ui/button";

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
  const [expanded, setExpanded] = useState(false);
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
  const flagged = lines.filter((line) => line.needsApproval).length;
  // bo-09: tất cả đạt → một dòng tóm tắt, bảng chỉ mở khi cần xem; có dòng cần duyệt → bảng hiện, dòng đó ở đầu.
  const allOk = flagged === 0;
  return (
    <DetailSection
      title={showReview ? L.section.reviewTitle : L.section.checkTitle}
      icon={Scale}
      defaultOpen={draft}
    >
      <div className="space-y-3">
        {check?.needsApproval && <Notice tone="warning">{L.notice.willNeedApproval}</Notice>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {allOk ? (
            <p className="text-positive-ink inline-flex items-center gap-1.5 text-[0.8125rem] font-medium">
              <CheckCircle2 className="text-dot-positive size-4" aria-hidden="true" />
              {L.section.allOk(lines.length, lines.length)}
            </p>
          ) : (
            <p className="text-warning-ink text-[0.8125rem] font-medium">
              {L.section.someNeedApproval(flagged, lines.length)}
            </p>
          )}
          {allOk && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={expanded}
              aria-controls="quote-price-check-details"
              onClick={() => setExpanded((open) => !open)}
              className="h-7 gap-1 px-2"
            >
              {expanded ? L.section.hideDetails : L.section.showDetails}
              <ChevronDown
                className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </Button>
          )}
        </div>
        <p className="text-ink-secondary text-xs">
          {L.section.threshold(formatDecimal(threshold, 2))}
        </p>
        {(!allOk || expanded) && (
          <div id="quote-price-check-details">
            <PriceCheckTable lines={lines} />
          </div>
        )}
      </div>
    </DetailSection>
  );
}
