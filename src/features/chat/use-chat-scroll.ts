"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { shouldStickToBottom } from "./selectors";

/**
 * Cuộn của danh sách tin: lần đầu và mỗi tin mới đều xuống cuối nếu người dùng đang ở cuối (hoặc tin mới là của chính
 * họ); đang đọc tin cũ thì giữ nguyên chỗ và hiện chip "Có tin mới"; chèn trang cũ phía trên thì bù chiều cao để
 * không nhảy.
 */
export function useChatScroll(newestSeq: number, oldestSeq: number, newestIsMine: boolean) {
  const listRef = useRef<HTMLOListElement>(null);
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
