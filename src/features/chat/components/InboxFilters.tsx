"use client";

import {
  CHAT_CONVERSATION_STATUSES,
  CHAT_INBOX_SCOPE_LABELS,
  CHAT_INBOX_SCOPES,
  CHAT_STATUS_LABELS,
} from "@/constants";
import { Button } from "@/components/ui/button";

import type { ChatConversationStatus, ChatInboxScope } from "@/constants";

const SELECT =
  "border-border-default bg-bg-surface h-10 rounded-[var(--control-radius)] border px-2 text-[0.8125rem]";

const toStatus = (value: string): ChatConversationStatus | null =>
  CHAT_CONVERSATION_STATUSES.find((status) => status === value) ?? null;

/** Bộ lọc hộp thư: phạm vi (tất cả / của tôi / chưa phân công / quá hạn) + trạng thái. */
export function InboxFilters({
  scope,
  status,
  onScope,
  onStatus,
}: {
  scope: ChatInboxScope;
  status: ChatConversationStatus | null;
  onScope: (scope: ChatInboxScope) => void;
  onStatus: (status: ChatConversationStatus | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* BO-UX-47: a toggle group (aria-pressed) — it filters this list in place, it does not switch tab panels. */}
      <div role="group" aria-label="Phạm vi" className="flex gap-1">
        {CHAT_INBOX_SCOPES.map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            aria-pressed={scope === value}
            variant={scope === value ? "default" : "outline"}
            onClick={() => onScope(value)}
          >
            {CHAT_INBOX_SCOPE_LABELS[value]}
          </Button>
        ))}
      </div>
      <select
        aria-label="Trạng thái"
        className={SELECT}
        value={status ?? ""}
        onChange={(event) => onStatus(toStatus(event.target.value))}
      >
        <option value="">Đang mở (mặc định)</option>
        {CHAT_CONVERSATION_STATUSES.map((value) => (
          <option key={value} value={value}>
            {CHAT_STATUS_LABELS[value]}
          </option>
        ))}
      </select>
    </div>
  );
}
