"use client";

import { useEffect, useState } from "react";
import { ArrowDown } from "lucide-react";

import { CHAT_A11Y_LABELS } from "@/constants";
import { useAuthStore } from "@/lib/auth";
import { Button } from "@/components/ui/button";

import { chatErrorMessage } from "../mutations";
import { useGapMessages, useOlderMessages } from "../queries";
import { hasMessageGap, mergeMessages } from "../selectors";
import { useChatScroll, useNewMessageAnnouncer } from "../use-chat-scroll";

import { MessageItem } from "./MessageItem";

import type { ChatMessagePage } from "../schemas";
import type { QuoteGate } from "./ChatCardView";

/**
 * Tin của hội thoại: trang mới nhất (socket / poll, từ màn hình) + tin cũ tải theo yêu cầu ("Tải tin cũ hơn" gọi
 * `before = nextBefore`), gộp theo `seq`. Tự cuộn xuống khi đang ở cuối; giữ vị trí khi tải tin cũ.
 * BO-UX-46: vùng cuộn nhận focus bàn phím (có nhãn); tin mới của người khác được đọc qua một log `aria-live` ẩn —
 * chỉ tin mới, không đọc lại lịch sử hay trang cũ vừa tải.
 */
export function MessageList({
  conversationId,
  customerId,
  latest,
  quoteGate,
}: {
  conversationId: string;
  customerId?: string;
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
  const {
    hasNextPage: gapHasMore,
    isFetching: gapFetching,
    isError: gapFailed,
    fetchNextPage: gapMore,
  } = gap;
  // A failing page 2+ keeps `hasNextPage` true and `isFetching` false: without `!gapFailed` this refires forever;
  // the "Thử lại" button (refetch) is what retries.
  useEffect(() => {
    if (holey && gapHasMore && !gapFetching && !gapFailed) void gapMore();
  }, [holey, gapHasMore, gapFetching, gapFailed, gapMore]);
  const newest = items[items.length - 1];
  const announcements = useNewMessageAnnouncer(newest, meId);
  const { listRef, onScroll, unseen, jumpToBottom, rememberHeight } = useChatScroll<HTMLDivElement>(
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
      <div
        role="log"
        aria-live="polite"
        aria-label={CHAT_A11Y_LABELS.newMessagesLog}
        className="sr-only"
      >
        {announcements.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
      <div
        ref={listRef}
        onScroll={onScroll}
        role="region"
        aria-label={CHAT_A11Y_LABELS.messageRegion}
        tabIndex={0}
        className="max-h-[560px] overflow-y-auto rounded-[var(--r-sm)]"
      >
        <ol aria-label={CHAT_A11Y_LABELS.messageList} className="space-y-2">
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
            <MessageItem
              key={message.id}
              message={message}
              customerId={customerId}
              quoteGate={quoteGate}
            />
          ))}
        </ol>
      </div>
      {unseen && (
        <Button
          size="sm"
          className="absolute bottom-2 left-1/2 -translate-x-1/2 shadow-md"
          aria-label={CHAT_A11Y_LABELS.jumpToNewAria}
          onClick={jumpToBottom}
        >
          {CHAT_A11Y_LABELS.jumpToNew} <ArrowDown aria-hidden className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
