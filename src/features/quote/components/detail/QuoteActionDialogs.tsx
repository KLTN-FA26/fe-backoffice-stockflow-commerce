"use client";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import { PriceReviewDialogs } from "../price-review/PriceReviewDialogs";
import { CancelQuoteDialog } from "./CancelQuoteDialog";
import { ConvertQuoteDialog } from "./ConvertQuoteDialog";
import { SendQuoteDialog } from "./SendQuoteDialog";

import type { useReviseQuote } from "@/features/quote/mutations";
import type { Quote } from "@/features/quote/types";
import type { PriceReviewDialog } from "../price-review/PriceReviewDialogs";

export type QuoteDialog = "send" | "cancel" | "revise" | "convert" | null;

/**
 * Hộp thoại của các thao tác trên header báo giá — đặt ngoài menu "⋯" để bấm mục rồi menu đóng thì hộp thoại vẫn mở.
 * Mỗi hộp thoại gửi kèm `version` đang hiển thị (BE OPTIMISTIC_LOCK).
 */
export function QuoteActionDialogs({
  quote,
  dialog,
  review,
  revise,
  onClose,
  onCloseReview,
  onError,
}: {
  quote: Quote;
  dialog: QuoteDialog;
  review: PriceReviewDialog;
  revise: ReturnType<typeof useReviseQuote>;
  onClose: () => void;
  onCloseReview: () => void;
  onError: (error: unknown) => void;
}) {
  return (
    <>
      <PriceReviewDialogs quote={quote} open={review} onClose={onCloseReview} onError={onError} />
      <SendQuoteDialog quote={quote} open={dialog === "send"} onClose={onClose} onError={onError} />
      <ConfirmDialog
        open={dialog === "revise"}
        onOpenChange={(open) => !open && onClose()}
        title="Mở bản sửa?"
        description="Báo giá trở về nháp (bản mới) để Sales điều chỉnh theo góp ý của khách, rồi gửi lại."
        confirmLabel="Mở bản sửa"
        variant="default"
        loading={revise.isPending}
        closeOnConfirm={false}
        onConfirm={() =>
          revise.mutate({ id: quote.id, version: quote.version }, { onSuccess: onClose, onError })
        }
      />
      <CancelQuoteDialog
        quote={quote}
        open={dialog === "cancel"}
        onClose={onClose}
        onError={onError}
      />
      <ConvertQuoteDialog
        quote={quote}
        open={dialog === "convert"}
        onOpenChange={(open) => !open && onClose()}
      />
    </>
  );
}
