/**
 * Tìm hội thoại chat của Sale về một thiết kế / dự án (BE `StaffChatController` `GET /chat/conversations`,
 * lọc `contextKind` + `contextId`). Đặt ở `lib/references` để feature khác dùng mà không import `features/chat`.
 *
 * BE mặc định bỏ hội thoại đã kết thúc khỏi hộp thư → luôn gửi `status` tường minh. Kết quả BE xếp hội thoại quá hạn
 * trước, rồi mới nhất; lấy 1 hội thoại đầu.
 */

import { z } from "zod";

import { CHAT_CONVERSATION_STATUSES } from "@/constants";

import { api } from "@/lib/api/client";

const CONVERSATIONS = "/chat/conversations";

/** Hội thoại đã kết thúc: BE từ chối thao tác thẻ trên chúng (`CHAT_CONVERSATION_ENDED`). */
const ENDED_STATUSES: readonly string[] = ["RESOLVED", "AUTO_CLOSED", "CLOSED"];

export type ChatContextKind = "DESIGN" | "DESIGN_PROJECT" | "ORDER" | "QUOTE";

const lookupPageSchema = z.object({ items: z.array(z.object({ id: z.string() })) });

interface LookupOptions {
  /**
   * Chỉ hội thoại chưa kết thúc (để bấm thẻ chat); mặc định lấy cả hội thoại đã kết thúc (chỉ để đọc lại).
   */
  openOnly?: boolean;
  signal?: AbortSignal;
}

async function firstConversation(
  filter: Record<string, string>,
  options: LookupOptions,
): Promise<string | null> {
  const query = new URLSearchParams({ ...filter, page: "0", size: "1" });
  for (const status of CHAT_CONVERSATION_STATUSES) {
    if (options.openOnly && ENDED_STATUSES.includes(status)) continue;
    query.append("status", status);
  }
  const { data } = await api.get<unknown>(CONVERSATIONS, { params: query, signal: options.signal });
  return lookupPageSchema.parse(data).items[0]?.id ?? null;
}

/** @returns id hội thoại, hoặc `null` khi khách chưa có hội thoại nào về đối tượng này. */
export function findConversationAbout(
  kind: ChatContextKind,
  id: string,
  options: LookupOptions = {},
): Promise<string | null> {
  return firstConversation({ contextKind: kind, contextId: id }, options);
}

/**
 * Hội thoại đầu của một khách (mọi ngữ cảnh). BE xếp quá hạn trước rồi mới nhất, nên đây là hội thoại cần chú ý nhất,
 * không nhất thiết là mới nhất.
 */
export function findConversationOfCustomer(
  customerId: string,
  options: LookupOptions = {},
): Promise<string | null> {
  return firstConversation({ customerId }, options);
}
