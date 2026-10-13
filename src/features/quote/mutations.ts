/**
 * Báo giá — mutations + invalidation map (api-conventions §2.3).
 * - Mọi thao tác → `quoteKeys.all`.
 * - Chuyển thành đơn còn tạo đơn bán + giữ hàng → thêm root `orders` và tồn kho (khai báo lại
 *   chuỗi để không import chéo feature order).
 * - Lỗi dữ liệu cũ (OPTIMISTIC_LOCK, chuyển trạng thái sai, hết hạn) → tải lại báo giá.
 */

import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";

import {
  acceptQuote,
  cancelQuote,
  convertQuote,
  createQuote,
  requestQuoteChanges,
  reviseQuote,
  sendQuote,
  updateQuote,
} from "./api";
import { QUOTE_STALE_CODES } from "./errors";
import { quoteKeys } from "./queries";

import type { Quote, QuoteFormOutput } from "./types";

const STALE = [quoteKeys.all] as const;
/** = `orderKeys.all` của features/order — khai báo lại để không import chéo feature. */
const ORDER_ROOT_KEY = ["orders"] as const;

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
export const useCancelQuote = staff(cancelQuote, "Đã huỷ báo giá nháp.");
export const useConvertQuote = staff(convertQuote, "Đã tạo đơn bán từ báo giá.", [ORDER_ROOT_KEY]);
export const useAcceptQuote = staff(acceptQuote, "Đã chấp nhận báo giá. Sales sẽ tạo đơn hàng.");
export const useRequestQuoteChanges = staff(
  requestQuoteChanges,
  "Đã gửi yêu cầu chỉnh sửa cho Sales.",
);
