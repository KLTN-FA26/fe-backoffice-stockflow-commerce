/**
 * Báo giá — mutations + invalidation map (api-conventions §2.3).
 * - Mọi thao tác → `quoteKeys.all`.
 * - Tạo đơn từ báo giá tạo đơn Nháp (chưa giữ hàng, plan A5) → thêm root `orders`.
 * - Lỗi dữ liệu cũ (OPTIMISTIC_LOCK, chuyển trạng thái sai, hết hạn, trạng thái duyệt giá đã đổi) → tải lại báo giá,
 *   không tự gửi lại.
 */

import { QUOTE_PRICE_REVIEW_LABELS } from "@/constants";
import { QUERY_ROOTS } from "@/lib/api/query-roots";
import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";
import { toast } from "@/components/shared/Toast";

import {
  approveQuotePrice,
  cancelQuote,
  convertQuote,
  createQuote,
  rejectQuotePrice,
  reviseQuote,
  sendQuote,
  updateQuote,
  withdrawQuotePriceReview,
} from "./api";
import { QUOTE_STALE_CODES } from "./errors";
import { quoteKeys } from "./queries";

import type { Quote, QuoteFormOutput } from "./types";

const STALE = [quoteKeys.all] as const;
const T = QUOTE_PRICE_REVIEW_LABELS.toast;

function staff<TInput>(
  fn: (input: TInput) => Promise<Quote>,
  successMessage: string | ((quote: Quote) => string),
  extraInvalidate: readonly (readonly string[])[] = [],
) {
  return withStaleRefetch(
    createMutation<TInput, Quote>(fn, {
      invalidate: [quoteKeys.all, ...extraInvalidate],
      ...(typeof successMessage === "string"
        ? { successMessage }
        : { onSuccess: (quote: Quote) => toast.success(successMessage(quote)) }),
      showErrorToast: false,
    }),
    STALE,
    QUOTE_STALE_CODES,
  );
}

export const useCreateQuote = staff<{ requestId: string; values: QuoteFormOutput }>(
  createQuote,
  "Đã tạo báo giá nháp.",
);
export const useUpdateQuote = staff<{ id: string; version: number; values: QuoteFormOutput }>(
  updateQuote,
  "Đã lưu báo giá.",
);
/** 14 BR-10: BE có thể giữ báo giá ở nháp chờ duyệt giá thay vì gửi khách — câu báo theo response. */
export const useSendQuote = staff(sendQuote, (quote) =>
  quote.status === "DRAFT" && quote.priceReviewPending ? T.sentForApproval : T.sentToCustomer,
);
export const useReviseQuote = staff(reviseQuote, "Đã mở bản sửa của báo giá.");
export const useCancelQuote = staff(cancelQuote, "Đã huỷ báo giá.");
export const useConvertQuote = staff(convertQuote, "Đã tạo đơn Nháp từ báo giá.", [
  QUERY_ROOTS.orders,
]);
export const useApproveQuotePrice = staff(approveQuotePrice, T.approved);
export const useRejectQuotePrice = staff(rejectQuotePrice, T.rejected);
export const useWithdrawQuotePriceReview = staff(withdrawQuotePriceReview, T.withdrawn);
