/**
 * Báo giá — mutations + invalidation map (api-conventions §2.3).
 * - Mọi thao tác → `quoteKeys.all`.
 * - Tạo đơn từ báo giá tạo đơn Nháp (chưa giữ hàng, plan A5) → thêm root `orders`.
 * - Lỗi dữ liệu cũ (OPTIMISTIC_LOCK, chuyển trạng thái sai, hết hạn) → tải lại báo giá, không tự gửi lại.
 */

import { QUERY_ROOTS } from "@/lib/api/query-roots";
import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";

import { cancelQuote, convertQuote, createQuote, reviseQuote, sendQuote, updateQuote } from "./api";
import { QUOTE_STALE_CODES } from "./errors";
import { quoteKeys } from "./queries";

import type { Quote, QuoteFormOutput } from "./types";

const STALE = [quoteKeys.all] as const;

function staff<TInput>(
  fn: (input: TInput) => Promise<Quote>,
  successMessage: string,
  extraInvalidate: readonly (readonly string[])[] = [],
) {
  return withStaleRefetch(
    createMutation<TInput, Quote>(fn, {
      invalidate: [quoteKeys.all, ...extraInvalidate],
      successMessage,
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
export const useSendQuote = staff(sendQuote, "Đã gửi báo giá cho khách.");
export const useReviseQuote = staff(reviseQuote, "Đã mở bản sửa của báo giá.");
export const useCancelQuote = staff(cancelQuote, "Đã huỷ báo giá.");
export const useConvertQuote = staff(convertQuote, "Đã tạo đơn Nháp từ báo giá.", [
  QUERY_ROOTS.orders,
]);
