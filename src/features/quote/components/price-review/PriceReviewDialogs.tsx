"use client";

import { useState } from "react";

import { QUOTE_PRICE_REVIEW_LABELS, QUOTE_PRICE_REVIEW_LIMITS } from "@/constants";
import {
  useApproveQuotePrice,
  useRejectQuotePrice,
  useWithdrawQuotePriceReview,
} from "@/features/quote/mutations";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { Quote } from "@/features/quote/types";

const L = QUOTE_PRICE_REVIEW_LABELS;
const MAX = QUOTE_PRICE_REVIEW_LIMITS.noteMax;

export type PriceReviewDialog = "approvePrice" | "rejectPrice" | "withdrawPriceReview" | null;

/**
 * Ba hộp thoại duyệt giá (14 BR-10), gửi kèm `version` đang hiển thị: duyệt (ghi chú không bắt buộc, ≤ 500 ký tự) → báo
 * giá gửi khách ngay; từ chối (lý do bắt buộc, ≤ 500 ký tự) → về nháp; rút lại (Sales) → về nháp. Lỗi hiện trong hộp
 * thoại; lỗi dữ liệu cũ tải lại báo giá (mutation).
 */
export function PriceReviewDialogs({
  quote,
  open,
  onClose,
  onError,
}: {
  quote: Quote;
  open: PriceReviewDialog;
  onClose: () => void;
  onError: (error: unknown) => void;
}) {
  const [note, setNote] = useState("");
  const approve = useApproveQuotePrice();
  const reject = useRejectQuotePrice();
  const withdraw = useWithdrawQuotePriceReview();
  const target = { id: quote.id, version: quote.version };
  const close = () => {
    setNote("");
    onClose();
  };
  const callbacks = { onSuccess: close, onError };

  return (
    <>
      <ConfirmDialog
        open={open === "approvePrice"}
        onOpenChange={(next) => !next && close()}
        title={L.approveDialog.title}
        description={L.approveDialog.description}
        confirmLabel={L.approveDialog.confirm}
        variant="default"
        loading={approve.isPending}
        closeOnConfirm={false}
        confirmDisabled={note.length > MAX}
        onConfirm={() => approve.mutate({ ...target, note }, callbacks)}
      >
        <div className="space-y-1">
          <Label htmlFor="price-approval-note" className="text-ink-secondary text-xs font-medium">
            {L.approveDialog.noteLabel}
          </Label>
          <Textarea
            id="price-approval-note"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          {note.length > MAX && <p className="text-danger text-xs">{L.noteTooLong}</p>}
        </div>
      </ConfirmDialog>
      <ConfirmDialog
        open={open === "rejectPrice"}
        onOpenChange={(next) => !next && close()}
        title={L.rejectDialog.title}
        description={L.rejectDialog.description}
        confirmLabel={L.rejectDialog.confirm}
        requireReason
        reasonLabel={L.rejectDialog.reasonLabel}
        reasonMaxLength={MAX}
        loading={reject.isPending}
        closeOnConfirm={false}
        onConfirm={(reason) => reject.mutate({ ...target, reason: reason ?? "" }, callbacks)}
      />
      <ConfirmDialog
        open={open === "withdrawPriceReview"}
        onOpenChange={(next) => !next && close()}
        title={L.withdrawDialog.title}
        description={L.withdrawDialog.description}
        confirmLabel={L.withdrawDialog.confirm}
        variant="default"
        loading={withdraw.isPending}
        closeOnConfirm={false}
        onConfirm={() => withdraw.mutate(target, callbacks)}
      />
    </>
  );
}
