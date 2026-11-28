"use client";

import Link from "next/link";

import {
  ADMIN_ROUTES,
  CHAT_A11Y_LABELS,
  CHAT_STATUS_LABELS,
  CHAT_STATUS_TONE_KEY,
} from "@/constants";
import { CHAT_INBOX_LABELS } from "@/constants/labels-chat";
import { formatDateTime } from "@/lib/format/date";
import { salesOwnerLine } from "@/lib/references/sales-owner-access";
import { StatusDot } from "@/components/shared/StatusDot";

import { inboxTime, messagePreview } from "../inbox-view";

import type { SalesOwner } from "@/lib/references/sales-owner-access";
import type { ChatConversation } from "../schemas";

/** Tone đỏ của `status-map` cho "Quá hạn" — cùng dáng chấm + chữ với trạng thái hội thoại (bo-32). */
const OVERDUE_TONE_KEY = "Overdue";

/**
 * Một dòng hộp thư: chủ đề, khách, người phụ trách, tin cuối, quá hạn, số chưa đọc, trạng thái. Chưa đọc (BO-UX-47):
 * chủ đề và tin cuối in đậm, số chưa đọc đọc thành "n tin chưa đọc" (không phải con số trần). Tin cuối không lộ mã trạng
 * thái của BE, giờ ngắn một dòng (bo-32); trạng thái và "Quá hạn" xếp chồng trong một cột cùng kiểu chấm + chữ.
 * Sale phụ trách khách (KE-HOACH sales-owner §6 "hàng chờ chat hiện ai là người phụ trách"): dòng phụ dưới khách — hàng chờ
 * chỉ có khách chưa có chủ (BR-S05), dòng này cho thấy điều đó.
 */
export function InboxRow({ item, owner }: { item: ChatConversation; owner?: SalesOwner }) {
  const ownerLine = salesOwnerLine(owner);
  const unread = item.unread > 0;
  const overdue = item.firstResponseOverdue || item.resolutionOverdue;
  const preview = item.lastMessage ? messagePreview(item.lastMessage) : null;
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
          {item.customerName} · {item.assignedAgentName ?? CHAT_INBOX_LABELS.unassigned}
          {preview ? ` · ${preview}` : ""}
        </div>
        {ownerLine && <div className="text-ink-tertiary truncate text-xs">{ownerLine}</div>}
      </div>
      {unread && (
        <span className="bg-brand text-ink-inverse shrink-0 rounded-full px-2 text-xs tabular-nums">
          <span aria-hidden>{item.unread}</span>
          <span className="sr-only">{CHAT_A11Y_LABELS.unreadBadge(item.unread)}</span>
        </span>
      )}
      <div className="flex w-32 shrink-0 flex-col items-start gap-0.5">
        <StatusDot
          domain="order"
          status={CHAT_STATUS_TONE_KEY[item.status]}
          label={CHAT_STATUS_LABELS[item.status]}
        />
        {overdue && (
          <StatusDot domain="order" status={OVERDUE_TONE_KEY} label={CHAT_INBOX_LABELS.overdue} />
        )}
      </div>
      <span
        className="text-ink-tertiary w-20 shrink-0 text-right text-xs whitespace-nowrap tabular-nums"
        title={item.lastMessageAt ? formatDateTime(item.lastMessageAt) : undefined}
      >
        {item.lastMessageAt ? inboxTime(item.lastMessageAt) : ""}
      </span>
    </Link>
  );
}
