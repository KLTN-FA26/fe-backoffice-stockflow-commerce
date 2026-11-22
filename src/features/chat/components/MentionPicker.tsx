"use client";

import { useEffect, useMemo, useRef } from "react";

import { CHAT_MENTION_LABELS as TEXT } from "@/constants";

import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

import { useStaffSearch } from "../queries";

import type { ChatStaff } from "../schemas";

const ROW = "text-[0.8125rem] px-3 py-2";

/**
 * Danh sách đồng nghiệp để @nhắc trong ghi chú nội bộ (BE-11 `GET /chat/staff?q=`). Focus ở lại ô soạn:
 * ↑/↓/Enter/Esc do Composer xử lý, `activeId` là dòng đang chọn. `query` đã debounce.
 */
export function MentionPicker({
  query,
  listId,
  activeId,
  onActiveChange,
  onPick,
  onItems,
  onActiveDomId,
}: {
  query: string;
  listId: string;
  activeId: string;
  onActiveChange: (id: string) => void;
  onPick: (staff: ChatStaff) => void;
  /** Composer cần biết các dòng hiện có để ↑/↓/Enter. */
  onItems: (items: ChatStaff[]) => void;
  /** DOM id cmdk gave the highlighted row, for `aria-activedescendant` on the textarea. */
  onActiveDomId: (id: string | undefined) => void;
}) {
  const search = useStaffSearch(query, true);
  const items = useMemo(() => search.data ?? [], [search.data]);
  // Report the visible rows upward for keyboard handling.
  useEffect(() => onItems(items), [items, onItems]);
  const box = useRef<HTMLDivElement>(null);
  // cmdk owns the ids of its rows; read the highlighted one back from the DOM.
  useEffect(() => {
    const rows = box.current?.querySelectorAll<HTMLElement>("[cmdk-item]") ?? [];
    onActiveDomId([...rows].find((row) => row.dataset.value === activeId)?.id);
  }, [activeId, items, onActiveDomId]);
  return (
    <Command
      shouldFilter={false}
      value={activeId}
      onValueChange={onActiveChange}
      label={TEXT.pickerLabel}
      className="border-border-default bg-bg-surface max-h-48 rounded-[var(--r-sm)] border"
    >
      {/* cmdk owns the listbox id, so `aria-controls` points at this wrapper */}
      <div id={listId} ref={box}>
        <CommandList>
          {search.isPending && <p className={`text-ink-tertiary ${ROW}`}>{TEXT.searching}</p>}
          {search.isError && (
            <p role="alert" className={`text-danger ${ROW}`}>
              {TEXT.loadError}
            </p>
          )}
          {search.isSuccess && items.length === 0 && (
            <p className={`text-ink-tertiary ${ROW}`}>{TEXT.noMatch}</p>
          )}
          {items.length > 0 && (
            <CommandGroup>
              {items.map((person) => (
                <CommandItem
                  key={person.id}
                  value={person.id}
                  // Keep the caret in the textarea while clicking a row.
                  onMouseDown={(event) => event.preventDefault()}
                  onSelect={() => onPick(person)}
                  className="data-selected:bg-bg-muted data-selected:text-ink-primary"
                >
                  <span className="text-ink-primary font-medium">{person.name}</span>
                  {person.roleName && (
                    <span className="text-ink-tertiary"> — {person.roleName}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </div>
    </Command>
  );
}
