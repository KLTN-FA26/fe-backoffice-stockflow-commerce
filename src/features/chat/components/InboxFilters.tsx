"use client";

import {
  CHAT_CONVERSATION_STATUSES,
  CHAT_INBOX_SCOPE_LABELS,
  CHAT_INBOX_SCOPES,
  CHAT_STATUS_LABELS,
} from "@/constants";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/combobox-select";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Button } from "@/components/ui/button";

import type { ChatConversationStatus, ChatInboxScope } from "@/constants";

const SELECT =
  "border-border-default bg-bg-surface h-10 rounded-[var(--control-radius)] border px-2 text-[0.8125rem] data-[size=default]:h-10";

/** Đại diện cho "đang mở (mặc định)" = status null — SelectItem không nhận value rỗng. */
const DEFAULT_STATUS = "__default__";

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
      <Select
        value={status ?? DEFAULT_STATUS}
        onValueChange={(next) => onStatus(next === DEFAULT_STATUS ? null : toStatus(next))}
      >
        <SelectTrigger aria-label="Trạng thái" className={SELECT}>
          <SelectValue />
        </SelectTrigger>
        <TitledSelectContent title="Trạng thái">
          <SelectItem value={DEFAULT_STATUS}>Đang mở (mặc định)</SelectItem>
          {CHAT_CONVERSATION_STATUSES.map((value) => (
            <SelectItem key={value} value={value}>
              {CHAT_STATUS_LABELS[value]}
            </SelectItem>
          ))}
        </TitledSelectContent>
      </Select>
    </div>
  );
}
