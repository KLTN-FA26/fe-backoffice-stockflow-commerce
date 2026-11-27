"use client";

import { CheckCircle2, FileOutput, FilePenLine, Send } from "lucide-react";

import { QUOTE_PRICE_REVIEW_LABELS } from "@/constants";
import { ActionTrigger } from "@/components/shared/ObjectActions";

import type { StaffQuoteAction } from "@/features/quote/lifecycle";
import type { PriceReviewDialog } from "../price-review/PriceReviewDialogs";
import type { QuoteDialog } from "./QuoteActionDialogs";

/**
 * Nút của các việc có thể làm nút chính trên header báo giá (duyệt giá, gửi, mở bản sửa, tạo đơn). Cùng một nút dùng được
 * ở ngoài (nền đậm) lẫn trong menu "⋯" — `ActionTrigger` tự đổi dáng.
 */
export function quoteActionTrigger(
  action: StaffQuoteAction,
  ctx: {
    sendLabel: string;
    sendBlocked: string | null;
    revising: boolean;
    openDialog: (dialog: QuoteDialog) => void;
    openReview: (dialog: PriceReviewDialog) => void;
  },
) {
  switch (action) {
    case "approvePrice":
      return (
        <ActionTrigger
          icon={CheckCircle2}
          label={QUOTE_PRICE_REVIEW_LABELS.action.approve}
          onClick={() => ctx.openReview("approvePrice")}
        />
      );
    case "send":
      return (
        <ActionTrigger
          icon={Send}
          label={ctx.sendLabel}
          disabled={!!ctx.sendBlocked}
          title={ctx.sendBlocked ?? undefined}
          onClick={() => ctx.openDialog("send")}
        />
      );
    case "revise":
      return (
        <ActionTrigger
          icon={FilePenLine}
          label="Mở bản sửa"
          loading={ctx.revising}
          onClick={() => ctx.openDialog("revise")}
        />
      );
    case "convert":
      return (
        <ActionTrigger
          icon={FileOutput}
          label="Tạo đơn"
          onClick={() => ctx.openDialog("convert")}
        />
      );
    default:
      return null;
  }
}
