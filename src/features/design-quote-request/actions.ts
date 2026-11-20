/**
 * Việc "Mở chat" và "Lập báo giá" từ một yêu cầu báo giá. Điều hướng đi qua `navigate` do màn truyền vào để test được.
 */

import { ADMIN_ROUTES, DESIGN_QUOTE_REQUEST_LABELS as COPY } from "@/constants";

import { findConversationAbout } from "@/lib/references/chat-lookup";

import { toast } from "@/components/shared/Toast";

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
 * Lập báo giá từ một yêu cầu. Một thân hàm duy nhất để đổi sau: BE đã đồng ý thêm
 * `POST /design-quote-requests/{id}/quote` và `POST /design-project-quote-requests/{id}/quote` (trả báo giá nháp) —
 * khi có, thay thân hàm này bằng lời gọi đó rồi điều hướng tới báo giá vừa tạo.
 *
 * Hiện nay BE chỉ có thao tác thẻ chat `CREATE_QUOTE` (cần hội thoại chưa kết thúc): có hội thoại đang mở → vào chat
 * để bấm thẻ; không có → form báo giá tay, nhắc đóng yêu cầu sau đó.
 */
export async function startQuoteFromRequest(row: QuoteRequest, navigate: Navigate): Promise<void> {
  const { kind, id } = chatSubject(row);
  const conversationId = await findConversationAbout(kind, id, { openOnly: true });
  if (conversationId) {
    toast.info(COPY.quoteInChat);
    navigate(ADMIN_ROUTES.chat.detail(conversationId));
    return;
  }
  toast.info(COPY.quoteReminder);
  navigate(ADMIN_ROUTES.quotes.createForCustomer(row.customerId));
}
