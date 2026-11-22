"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MessagesSquare } from "lucide-react";

import { ADMIN_ROUTES, CHAT_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import {
  chatLookupKeys,
  findConversationAbout,
  findConversationOfCustomer,
} from "@/lib/references/chat-lookup";

import type { ChatContextKind } from "@/lib/references/chat-lookup";

export type RelatedConversationTarget =
  | { kind: Extract<ChatContextKind, "ORDER" | "QUOTE">; id: string }
  | { kind: "CUSTOMER"; id: string };

/**
 * Link "Hội thoại liên quan" trên trang đơn / báo giá / khách (WF-02 BO-11a, mục 38). Chỉ hiện khi đã có hội thoại
 * (BE `GET /chat/conversations?contextKind&contextId` hoặc `?customerId`); không có, đang tải hay lỗi thì không hiện
 * gì — không tự mở hội thoại mới ở đây. Chat dùng chung `chat-conversations:READ`.
 */
export function RelatedConversationLink({ target }: { target: RelatedConversationTarget }) {
  const canRead = useCan(CHAT_PERMISSIONS.read);
  const query = useQuery({
    queryKey: chatLookupKeys.about(target.kind, target.id),
    queryFn: ({ signal }) =>
      target.kind === "CUSTOMER"
        ? findConversationOfCustomer(target.id, { signal })
        : findConversationAbout(target.kind, target.id, { signal }),
    enabled: canRead,
    retry: false,
  });
  if (!canRead || !query.data) return null;
  return (
    <div className="flex justify-end pb-2">
      <Link
        href={ADMIN_ROUTES.chat.detail(query.data)}
        className="text-accent-text focus-visible:ring-ring inline-flex min-h-9 items-center gap-1.5 rounded-md text-sm hover:underline focus-visible:ring-2 focus-visible:outline-none"
      >
        <MessagesSquare className="size-4" aria-hidden="true" />
        Hội thoại liên quan
      </Link>
    </div>
  );
}
