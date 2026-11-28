"use client";

import { useState } from "react";

import { WINDOW_CHANGE_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { limitComboboxOptions } from "@/components/shared/combobox-options";
import {
  COMBOBOX_ITEM_CLASS,
  ComboboxMoreHint,
  InputCombobox,
} from "@/components/shared/InputCombobox";
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

import { useWindowConsentMessages } from "../../delivery-window-queries";

import type { ConsentMessage } from "../../delivery-window-api";

const L = WINDOW_CHANGE_LABELS.message;
const NOTE = "text-ink-tertiary px-3 py-1.5 text-xs";
/** Chữ trong ô khi đã chọn / dòng danh sách: một dòng, cắt ngắn (đủ để nhận ra tin). */
const PREVIEW_CHARS = 90;

const oneLine = (text: string): string => text.replace(/\s+/g, " ").trim();
const preview = (text: string): string =>
  text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS - 1)}…` : text;

/** Chữ của một tin: nội dung, hoặc "Tệp khách gửi trong chat" khi tin chỉ có tệp. */
export const messageLabel = (message: Pick<ConsentMessage, "text">): string =>
  preview(oneLine(message.text ?? "")) || L.attachmentOnly;

interface WindowEvidenceMessageProps {
  orderId: string;
  batchId: string;
  /** Id tin nhắn đang chọn ("" = chưa chọn). */
  value: string;
  onChange: (messageId: string) => void;
  id: string;
  hasError?: boolean;
  describedBy?: string;
}

/**
 * Chọn tin nhắn của khách làm bằng chứng đồng ý (docs 17 BR-28) — `InputCombobox` theo luật shared-components: gõ để tìm
 * (nội dung, chủ đề, giờ gửi) hoặc bấm mũi tên để xem danh sách, mỗi dòng 2 tầng (nội dung / giờ · chủ đề), tối đa 10 dòng
 * rồi "Còn N kết quả — gõ thêm". Không bao giờ hiện hay bắt gõ mã tin nhắn. Danh sách do BE lọc đúng điều kiện nó nhận
 * (tin của chính khách, trong chat về đơn này hoặc chưa gắn đơn) nên chọn được là gửi được.
 */
export function WindowEvidenceMessage({
  orderId,
  batchId,
  value,
  onChange,
  id,
  hasError,
  describedBy,
}: WindowEvidenceMessageProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const messages = useWindowConsentMessages(orderId, batchId);
  const all = messages.data ?? [];
  const picked = all.find((message) => message.messageId === value);
  const { visible, hidden } = limitComboboxOptions(all, search, (message) => [
    message.text ?? "",
    message.subject ?? "",
    formatDateTime(message.sentAt),
  ]);
  const showEmpty = !messages.isPending && !messages.isError && all.length === 0;

  return (
    <>
      <InputCombobox
        id={id}
        open={open}
        onOpenChange={setOpen}
        displayValue={picked ? messageLabel(picked) : ""}
        placeholder={L.placeholder}
        searchPlaceholder={L.searchPlaceholder}
        ariaLabel={L.label}
        hasError={hasError}
        describedBy={describedBy}
        search={search}
        onSearchChange={setSearch}
        shouldFilter={false}
        onClear={() => onChange("")}
      >
        <CommandList>
          {messages.isPending ? (
            <p className={NOTE}>{L.loading}</p>
          ) : (
            <>
              {/* Lỗi tải không che những tin đã tải được — vẫn hiện danh sách, kèm mục thử lại */}
              {messages.isError && (
                <CommandItem
                  value="retry"
                  forceMount
                  className={COMBOBOX_ITEM_CLASS}
                  onSelect={() => void messages.refetch()}
                >
                  {L.loadError}
                </CommandItem>
              )}
              {!messages.isError && <CommandEmpty>{L.noMatch}</CommandEmpty>}
              <CommandGroup>
                {visible.map((message) => (
                  <CommandItem
                    key={message.messageId}
                    value={message.messageId}
                    className={COMBOBOX_ITEM_CLASS}
                    onSelect={() => {
                      onChange(message.messageId);
                      setSearch("");
                      setOpen(false);
                    }}
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{messageLabel(message)}</span>
                      <span className="text-ink-tertiary truncate text-xs tabular-nums">
                        {L.optionMeta(formatDateTime(message.sentAt), message.subject ?? null)}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
        {hidden > 0 && <ComboboxMoreHint remaining={hidden} />}
      </InputCombobox>
      {/* Chưa có tin nào dùng được: nói luôn dưới ô (danh sách chỉ mở khi gõ hoặc bấm mũi tên), chỉ đường sang tệp */}
      {showEmpty && (
        <p id={`${id}-empty`} role="status" className="text-ink-tertiary text-xs">
          {L.empty}
        </p>
      )}
    </>
  );
}
