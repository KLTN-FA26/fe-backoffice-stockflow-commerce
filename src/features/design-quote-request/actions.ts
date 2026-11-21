/**
 * Việc "Mở chat" và "Lập báo giá" từ một yêu cầu báo giá. Điều hướng đi qua `navigate` do màn truyền vào để test được.
 */

import { ADMIN_ROUTES, DESIGN_QUOTE_REQUEST_LABELS as COPY } from "@/constants";

import { findConversationAbout } from "@/lib/references/chat-lookup";

import { toast } from "@/components/shared/Toast";

import { createQuoteFromDesignRequest, createQuoteFromProjectRequest } from "./api";

import type { ChatContextKind } from "@/lib/references/chat-lookup";
import type { QuoteRequest } from "./types";

export type Navigate = (href: string) => void;

/** Thẻ yêu cầu báo giá gắn vào hội thoại về thiết kế (đơn lẻ) hoặc dự án (BE `DocumentCards.java:93-118`). */
function chatSubject(row: QuoteRequest): { kind: ChatContextKind; id: string } {
  return "lines" in row
    ? { kind: "DESIGN_PROJECT", id: row.projectId }
    : { kind: "DESIGN", id: row.designId };
}

/** Có hội thoại → vào chat; không → báo, không tự mở hội thoại mới. */
export async function openChatAbout(row: QuoteRequest, navigate: Navigate): Promise<void> {
  const { kind, id } = chatSubject(row);
  const conversationId = await findConversationAbout(kind, id);
  if (conversationId) {
    navigate(ADMIN_ROUTES.chat.detail(conversationId));
    return;
  }
  toast.info("lines" in row ? COPY.noConversationProject : COPY.noConversation);
}

/**
 * Lập báo giá từ một yêu cầu: BE tạo (hoặc trả lại) báo giá và tự đóng yêu cầu → mở màn sửa khi còn nháp, ngược lại
 * (đã gửi khách từ trước) mở trang chi tiết. Không cần hội thoại chat. Một thân hàm duy nhất nên các nơi gọi không đổi.
 */
export async function startQuoteFromRequest(row: QuoteRequest, navigate: Navigate): Promise<void> {
  const quote =
    "lines" in row
      ? await createQuoteFromProjectRequest(row.id)
      : await createQuoteFromDesignRequest(row.id);
  navigate(
    quote.status === "DRAFT"
      ? ADMIN_ROUTES.quotes.edit(quote.id)
      : ADMIN_ROUTES.quotes.detail(quote.id),
  );
}
