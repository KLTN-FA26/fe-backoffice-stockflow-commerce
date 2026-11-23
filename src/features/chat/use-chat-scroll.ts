"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { CHAT_A11Y_LABELS } from "@/constants";

import { cardKindLabel } from "./card-view";
import { shouldStickToBottom } from "./selectors";

import type { ChatMessage } from "./schemas";

/**
 * Cuộn của danh sách tin: lần đầu và mỗi tin mới đều xuống cuối nếu người dùng đang ở cuối (hoặc tin mới là của chính
 * họ); đang đọc tin cũ thì giữ nguyên chỗ và hiện chip "Có tin mới"; chèn trang cũ phía trên thì bù chiều cao để
 * không nhảy.
 */
export function useChatScroll<T extends HTMLElement = HTMLOListElement>(
  newestSeq: number,
  oldestSeq: number,
  newestIsMine: boolean,
) {
  const listRef = useRef<T>(null);
  const stick = useRef(true);
  const seen = useRef({ newest: 0, oldest: 0 });
  const heightBeforeOlder = useRef<number | null>(null);
  const [unseen, setUnseen] = useState(false);

  const onScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    stick.current = shouldStickToBottom(el);
    if (stick.current) setUnseen(false);
  }, []);

  const jumpToBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    stick.current = true;
    setUnseen(false);
  }, []);

  /** Gọi ngay trước khi tải trang cũ: nhớ chiều cao để bù sau khi tin cũ chèn lên đầu. */
  const rememberHeight = useCallback(() => {
    heightBeforeOlder.current = listRef.current?.scrollHeight ?? null;
  }, []);

  useLayoutEffect(() => {
    const el = listRef.current;
    const prev = seen.current;
    seen.current = { newest: newestSeq, oldest: oldestSeq };
    if (!el) return;
    if (prev.oldest !== 0 && oldestSeq < prev.oldest && heightBeforeOlder.current !== null) {
      el.scrollTop += el.scrollHeight - heightBeforeOlder.current;
      heightBeforeOlder.current = null;
      return;
    }
    if (newestSeq <= prev.newest) return;
    if (stick.current || newestIsMine) {
      el.scrollTop = el.scrollHeight;
      stick.current = true;
    } else {
      setUnseen(true);
    }
  }, [newestSeq, oldestSeq, newestIsMine]);

  return { listRef, onScroll, unseen, jumpToBottom, rememberHeight };
}

const PREVIEW_MAX = 140;

/** One line a screen reader reads for a message that just arrived (BO-UX-46): who, then what. */
export function newMessageAnnouncement(
  message: Pick<ChatMessage, "senderName" | "senderType" | "body" | "card" | "attachments">,
): string {
  const L = CHAT_A11Y_LABELS;
  const sender =
    message.senderName ??
    (message.senderType === "CUSTOMER"
      ? L.customer
      : message.senderType === "SYSTEM"
        ? L.system
        : "");
  const text =
    message.body ??
    (message.card ? cardKindLabel(message.card.kind) : message.attachments[0]?.fileName) ??
    L.attachment;
  const preview = text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX)}…` : text;
  return L.newMessage(sender || L.customer, preview);
}

/**
 * The lines of the conversation's polite live log (BO-UX-46): one per message that arrives from someone else after
 * the list opened — not the history it opened with, not older pages loaded on request, not the viewer's own.
 */
export function useNewMessageAnnouncer(
  newest: ChatMessage | undefined,
  meId: string | null,
): string[] {
  // Adjusted while rendering (react.dev "adjusting state when a prop changes"), not in an effect.
  const [log, setLog] = useState({ seen: newest?.seq ?? 0, lines: [] as string[] });
  if (newest && newest.seq > log.seen) {
    const mine = !!meId && newest.senderId === meId;
    setLog({
      seen: newest.seq,
      lines: mine ? log.lines : [...log.lines.slice(-4), newMessageAnnouncement(newest)],
    });
  }
  return log.lines;
}
