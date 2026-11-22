/**
 * Mutation của hộp yêu cầu báo giá. Đóng yêu cầu: tải lại danh sách của chính nó và hội thoại chat (BE phát
 * `DesignQuoteRequestClosed` → thẻ chat của khách đổi trạng thái).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { DESIGN_QUOTE_REQUEST_LABELS as COPY } from "@/constants";

import { ApiError } from "@/lib/api/error";
import { serverErrorMessage } from "@/lib/api/error-message";
import { QUERY_ROOTS } from "@/lib/api/query-roots";

import { toast } from "@/components/shared/Toast";

import { openChatAbout, startQuoteFromRequest } from "./actions";
import { closeDesignQuoteRequest, closeProjectQuoteRequest } from "./api";
import { designQuoteRequestKeys, projectQuoteRequestKeys } from "./queries";

import type { Navigate } from "./actions";
import type { QuoteRequest } from "./types";

/** Root query của chat và báo giá (feature không import chéo → `QUERY_ROOTS`, có test đối chiếu key factory). */
const CHAT_ROOT = QUERY_ROOTS.chat;
const QUOTES_ROOT = QUERY_ROOTS.quotes;

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
 * Hai mã 409 chỉ xảy ra khi danh sách đã cũ (nút chỉ bật ở dòng OPEN, đủ điều kiện) → tải lại để dòng đổi theo.
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
    onError: (error) => {
      toast.error(serverErrorMessage(error, START_QUOTE_ERRORS));
      if (error instanceof ApiError && error.code in START_QUOTE_ERRORS) {
        void queryClient.invalidateQueries({ queryKey: designQuoteRequestKeys.all });
        void queryClient.invalidateQueries({ queryKey: projectQuoteRequestKeys.all });
      }
    },
  });
}
