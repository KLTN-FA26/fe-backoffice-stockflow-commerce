"use client";

import { useState } from "react";
import { ArrowDown } from "lucide-react";

import { useAuthStore } from "@/lib/auth";
import { Button } from "@/components/ui/button";

import { useOlderMessages } from "../queries";
import { mergeMessages } from "../selectors";
import { useChatScroll } from "../use-chat-scroll";

import { MessageItem } from "./MessageItem";

import type { ChatMessagePage } from "../schemas";
import type { QuoteGate } from "./ChatCardView";

/**
 * Tin của hội thoại: trang mới nhất (poll 5 giây, từ màn hình) + tin cũ tải theo yêu cầu ("Tải tin cũ hơn" gọi
 * `before = nextBefore`), gộp theo `seq`. Tự cuộn xuống khi đang ở cuối; giữ vị trí khi tải tin cũ.
 */
export function MessageList({
  conversationId,
  latest,
  quoteGate,
}: {
  conversationId: string;
  latest: ChatMessagePage;
  quoteGate: QuoteGate;
}) {
  const meId = useAuthStore((state) => state.user?.userId ?? null);
  const [anchor, setAnchor] = useState<number | null>(null);
  const older = useOlderMessages(conversationId, anchor);
  const items = mergeMessages(
    latest.items,
    (older.data?.pages ?? []).map((page) => page.items),
  );
  const newest = items[items.length - 1];
  const { listRef, onScroll, unseen, jumpToBottom, rememberHeight } = useChatScroll(
    newest?.seq ?? 0,
    items[0]?.seq ?? 0,
    !!meId && newest?.senderId === meId,
  );
  // Còn trang cũ hơn: chưa bấm lần nào → `nextBefore` của trang mới nhất; đã bấm → của trang cũ nhất đã tải.
  const loading = anchor !== null && (older.isPending || older.isFetchingNextPage);
  const hasOlder = anchor === null ? latest.nextBefore != null : loading || !!older.hasNextPage;
  const loadOlder = () => {
    rememberHeight();
    if (anchor === null) setAnchor(latest.nextBefore ?? null);
    else void older.fetchNextPage();
  };

  return (
    <div className="relative">
      <ol
        ref={listRef}
        onScroll={onScroll}
        aria-label="Tin nhắn"
        className="max-h-[560px] space-y-2 overflow-y-auto"
      >
        {hasOlder && (
          <li className="flex justify-center">
            <Button size="sm" variant="outline" disabled={loading} onClick={loadOlder}>
              {loading ? "Đang tải…" : "Tải tin cũ hơn"}
            </Button>
          </li>
        )}
        {items.map((message) => (
          <MessageItem key={message.id} message={message} quoteGate={quoteGate} />
        ))}
      </ol>
      {unseen && (
        <Button
          size="sm"
          className="absolute bottom-2 left-1/2 -translate-x-1/2 shadow-md"
          onClick={jumpToBottom}
        >
          Có tin mới <ArrowDown className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
