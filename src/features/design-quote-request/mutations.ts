/**
 * Mutation của hộp yêu cầu báo giá. Đóng yêu cầu: tải lại danh sách của chính nó và hội thoại chat (BE phát
 * `DesignQuoteRequestClosed` → thẻ chat của khách đổi trạng thái).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { DESIGN_QUOTE_REQUEST_LABELS as COPY, SHARED_QUERY_ROOTS } from "@/constants";

import { serverErrorMessage } from "@/lib/api/error-message";

import { toast } from "@/components/shared/Toast";

import { openChatAbout, startQuoteFromRequest } from "./actions";
import { closeDesignQuoteRequest, closeProjectQuoteRequest } from "./api";
import { designQuoteRequestKeys, projectQuoteRequestKeys } from "./queries";

import type { Navigate } from "./actions";
import type { QuoteRequest } from "./types";

/** Root query của chat và báo giá (feature không import chéo → qua `SHARED_QUERY_ROOTS`). */
const CHAT_ROOT = [SHARED_QUERY_ROOTS.chat] as const;
const QUOTES_ROOT = [SHARED_QUERY_ROOTS.salesQuotes] as const;

function useCloseRequest(close: (id: string) => Promise<void>, listRoot: readonly string[]) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: close,
    onSuccess: () => {
      toast.success(COPY.closed);
      void queryClient.invalidateQueries({ queryKey: listRoot });
      void queryClient.invalidateQueries({ queryKey: CHAT_ROOT });
    },
  });
}

export const useCloseDesignQuoteRequest = () =>
  useCloseRequest(closeDesignQuoteRequest, designQuoteRequestKeys.all);

export const useCloseProjectQuoteRequest = () =>
  useCloseRequest(closeProjectQuoteRequest, projectQuoteRequestKeys.all);

export function useOpenChat(navigate: Navigate) {
  return useMutation<void, Error, QuoteRequest>({
    mutationFn: (row) => openChatAbout(row, navigate),
    onError: () => toast.error("Không tìm được hội thoại. Thử lại sau."),
  });
}

/**
 * Lỗi lập báo giá (BE `QuoteFromRequestController`): câu riêng cho hai mã 409, còn lại (403/404…) câu chung / của BE.
 */
const START_QUOTE_ERRORS: Readonly<Record<string, string>> = {
  DESIGN_NOT_APPROVED: COPY.quoteNotApproved,
  DESIGN_QUOTE_REQUEST_CLOSED: COPY.quoteRequestClosed,
};

/**
 * Lập báo giá thành công: yêu cầu đã được BE đóng, thẻ chat đổi trạng thái, có thêm báo giá nháp → tải lại danh sách
 * yêu cầu, chat và báo giá.
 */
export function useStartQuote(navigate: Navigate) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, QuoteRequest>({
    mutationFn: (row) => startQuoteFromRequest(row, navigate),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: designQuoteRequestKeys.all });
      void queryClient.invalidateQueries({ queryKey: projectQuoteRequestKeys.all });
      void queryClient.invalidateQueries({ queryKey: CHAT_ROOT });
      void queryClient.invalidateQueries({ queryKey: QUOTES_ROOT });
    },
    onError: (error) => toast.error(serverErrorMessage(error, START_QUOTE_ERRORS)),
  });
}
