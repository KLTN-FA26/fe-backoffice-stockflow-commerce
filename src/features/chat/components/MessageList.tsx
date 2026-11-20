"use client";

import { useEffect, useState } from "react";
import { ArrowDown } from "lucide-react";

import { useAuthStore } from "@/lib/auth";
import { Button } from "@/components/ui/button";

import { chatErrorMessage } from "../mutations";
import { useGapMessages, useOlderMessages } from "../queries";
import { hasMessageGap, mergeMessages } from "../selectors";
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
  // Trang cũ đã tải kết thúc ngay dưới `anchor`. Tin mới đến làm cửa sổ mới nhất trượt đi (cũ nhất > anchor) →
  // tin ở giữa không nằm trong query nào: đọc lấp khoảng hở bằng `since`.
  const slid = anchor !== null && !!older.data && (latest.items[0]?.seq ?? 0) > anchor;
  const gap = useGapMessages(conversationId, anchor === null ? null : anchor - 1, slid);
  const items = mergeMessages(latest.items, [
    ...(older.data?.pages ?? []).map((page) => page.items),
    ...(gap.data?.pages ?? []).map((page) => page.items),
  ]);
  const holey = slid && hasMessageGap(items);
  const { hasNextPage: gapHasMore, isFetching: gapFetching, fetchNextPage: gapMore } = gap;
  useEffect(() => {
    if (holey && gapHasMore && !gapFetching) void gapMore();
  }, [holey, gapHasMore, gapFetching, gapMore]);
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
        {anchor !== null && (older.isError || gap.isError) && (
          <li className="text-danger flex flex-wrap items-center justify-center gap-2 text-xs">
            {chatErrorMessage(older.error ?? gap.error)}
            <Button
              size="sm"
              variant="outline"
              onClick={() => void (older.isError ? older.refetch() : gap.refetch())}
            >
              Thử lại
            </Button>
          </li>
        )}
        {hasOlder && !older.isError && (
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
