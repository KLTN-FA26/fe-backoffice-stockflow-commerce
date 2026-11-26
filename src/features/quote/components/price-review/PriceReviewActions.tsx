"use client";

import { useState } from "react";
import { CheckCircle2, Undo2, XCircle } from "lucide-react";

import { QUOTE_PRICE_APPROVAL_PERMISSIONS, QUOTE_PRICE_REVIEW_LABELS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { DETAIL_ACTION_CLASS } from "@/components/shared/DetailSection";
import { Button } from "@/components/ui/button";

import { PriceReviewDialogs } from "./PriceReviewDialogs";

import type { StaffQuoteAction } from "@/features/quote/lifecycle";
import type { Quote } from "@/features/quote/types";
import type { PriceReviewDialog } from "./PriceReviewDialogs";

const L = QUOTE_PRICE_REVIEW_LABELS;

/**
 * Nút của nháp đang chờ duyệt giá (14 BR-10), theo `allowedStaffQuoteActions`: "Duyệt giá" / "Từ chối" cho người có
 * `sales-quote-price-approvals:APPROVE` mà không phải người gửi duyệt; "Rút lại" cho Sales (`sales-quotes:UPDATE`).
 * Người có quyền duyệt nhưng chính là người gửi duyệt thấy câu giải thích thay cho nút (bốn mắt).
 */
export function PriceReviewActions({
  quote,
  actions,
  submittedByMe,
  onError,
}: {
  quote: Quote;
  actions: readonly StaffQuoteAction[];
  submittedByMe: boolean;
  onError: (error: unknown) => void;
}) {
  const canApprove = useCan(QUOTE_PRICE_APPROVAL_PERMISSIONS.approve);
  const [dialog, setDialog] = useState<PriceReviewDialog>(null);
  if (!quote.priceReviewPending) return null;
  const selfReview = submittedByMe && canApprove;

  return (
    <>
      {actions.includes("approvePrice") && (
        <Button
          type="button"
          size="sm"
          onClick={() => setDialog("approvePrice")}
          className={DETAIL_ACTION_CLASS.primary}
        >
          <CheckCircle2 className="size-3.5" /> {L.action.approve}
        </Button>
      )}
      {actions.includes("rejectPrice") && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setDialog("rejectPrice")}
          className={DETAIL_ACTION_CLASS.outline}
        >
          <XCircle className="size-3.5" /> {L.action.reject}
        </Button>
      )}
      {selfReview && <p className="text-ink-tertiary text-center text-xs">{L.notice.self}</p>}
      {actions.includes("withdrawPriceReview") && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setDialog("withdrawPriceReview")}
          className={DETAIL_ACTION_CLASS.outline}
        >
          <Undo2 className="size-3.5" /> {L.action.withdraw}
        </Button>
      )}
      <PriceReviewDialogs
        quote={quote}
        open={dialog}
        onClose={() => setDialog(null)}
        onError={onError}
      />
    </>
  );
}
