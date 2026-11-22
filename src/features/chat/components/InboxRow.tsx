"use client";

import Link from "next/link";

import {
  ADMIN_ROUTES,
  CHAT_A11Y_LABELS,
  CHAT_STATUS_LABELS,
  CHAT_STATUS_TONE_KEY,
} from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { StatusDot } from "@/components/shared/StatusDot";

import type { ChatConversation } from "../schemas";

/**
 * Một dòng hộp thư: chủ đề, khách, người phụ trách, tin cuối, quá hạn, số chưa đọc, trạng thái. Chưa đọc (BO-UX-47):
 * chủ đề và tin cuối in đậm, số chưa đọc đọc thành "n tin chưa đọc" (không phải con số trần).
 */
export function InboxRow({ item }: { item: ChatConversation }) {
  const unread = item.unread > 0;
  return (
    <Link
      href={ADMIN_ROUTES.chat.detail(item.id)}
      className="hover:bg-bg-muted flex items-center gap-3 px-4 py-3 text-[0.8125rem]"
    >
      <div className="min-w-0 flex-1">
        <div className={`text-ink-primary truncate ${unread ? "font-bold" : "font-medium"}`}>
          {item.subject ?? item.customerName ?? "Hội thoại"}
        </div>
        <div
          className={`truncate text-xs ${unread ? "text-ink-primary font-semibold" : "text-ink-tertiary"}`}
        >
          {item.customerName} · {item.assignedAgentName ?? "Chưa phân công"}
          {item.lastMessage?.body ? ` · ${item.lastMessage.body}` : ""}
        </div>
      </div>
      {(item.firstResponseOverdue || item.resolutionOverdue) && (
        <span className="text-danger text-xs font-medium">Quá hạn</span>
      )}
      {unread && (
        <span className="bg-brand text-ink-inverse rounded-full px-2 text-xs tabular-nums">
          <span aria-hidden>{item.unread}</span>
          <span className="sr-only">{CHAT_A11Y_LABELS.unreadBadge(item.unread)}</span>
        </span>
      )}
      <StatusDot
        domain="order"
        status={CHAT_STATUS_TONE_KEY[item.status]}
        label={CHAT_STATUS_LABELS[item.status]}
      />
      <span className="text-ink-tertiary w-32 text-right text-xs tabular-nums">
        {item.lastMessageAt ? formatDateTime(item.lastMessageAt) : ""}
      </span>
    </Link>
  );
}
