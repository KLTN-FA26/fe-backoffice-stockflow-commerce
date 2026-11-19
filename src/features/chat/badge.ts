"use client";

/** Huy hiệu menu "Chat với khách" (S22): tin chưa đọc ở hội thoại giao cho mình + hội thoại chờ nhận. */

import { CHAT_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth";

import { useStaffUnread } from "./queries";

export function useStaffChatBadge(): number {
  const canRead = useCan(CHAT_PERMISSIONS.read);
  const unread = useStaffUnread(canRead);
  return canRead && unread.data ? unread.data.messages + unread.data.queued : 0;
}
