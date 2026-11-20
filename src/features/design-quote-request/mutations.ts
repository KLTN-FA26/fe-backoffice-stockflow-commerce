/**
 * Mutation của hộp yêu cầu báo giá. Đóng yêu cầu: tải lại danh sách của chính nó và hội thoại chat (BE phát
 * `DesignQuoteRequestClosed` → thẻ chat của khách đổi trạng thái).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { DESIGN_QUOTE_REQUEST_LABELS as COPY } from "@/constants";

import { toast } from "@/components/shared/Toast";

import { openChatAbout, startQuoteFromRequest } from "./actions";
import { closeDesignQuoteRequest, closeProjectQuoteRequest } from "./api";
import { designQuoteRequestKeys, projectQuoteRequestKeys } from "./queries";

import type { Navigate } from "./actions";
import type { QuoteRequest } from "./types";

/** Root query của chat (= `chatKeys.all` ở features/chat; feature không import chéo). */
const CHAT_ROOT = ["chat"] as const;

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

export function useStartQuote(navigate: Navigate) {
  return useMutation<void, Error, QuoteRequest>({
    mutationFn: (row) => startQuoteFromRequest(row, navigate),
    onError: () => toast.error("Không mở được màn lập báo giá. Thử lại sau."),
  });
}
