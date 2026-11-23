"use client";

/**
 * Huy hiệu menu "Chat với khách" (S22): tin chưa đọc ở hội thoại giao cho mình + hội thoại chờ nhận. Huy hiệu sống ở
 * khung back-office nên cũng là nơi nghe hàng đợi và hàng riêng của người dùng qua socket (A.3): hộp thư, huy hiệu
 * và thông báo @nhắc cập nhật ở mọi trang.
 */

import { CHAT_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth";

import { useStaffUnread } from "./queries";
import { useStaffChatRealtime } from "./realtime";

export function useStaffChatBadge(): number {
  const canRead = useCan(CHAT_PERMISSIONS.read);
  const unread = useStaffUnread(canRead);
  useStaffChatRealtime(canRead);
  return canRead && unread.data ? unread.data.messages + unread.data.queued : 0;
}
