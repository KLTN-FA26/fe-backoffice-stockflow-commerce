"use client";

import { useEffect, useMemo } from "react";

import { useStaffSearch } from "../queries";

import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

import type { ChatStaff } from "../schemas";

const ROW = "text-[0.8125rem] px-3 py-2";

/**
 * Danh sách đồng nghiệp để @nhắc trong ghi chú nội bộ (BE-11 `GET /chat/staff?q=`). Focus ở lại ô soạn:
 * ↑/↓/Enter/Esc do Composer xử lý, `activeId` là dòng đang chọn. `query` đã debounce.
 */
export function MentionPicker({
  query,
  activeId,
  onActiveChange,
  onPick,
  onItems,
}: {
  query: string;
  activeId: string;
  onActiveChange: (id: string) => void;
  onPick: (staff: ChatStaff) => void;
  /** Composer cần biết các dòng hiện có để ↑/↓/Enter. */
  onItems: (items: ChatStaff[]) => void;
}) {
  const search = useStaffSearch(query, true);
  const items = useMemo(() => search.data ?? [], [search.data]);
  // Report the visible rows upward for keyboard handling.
  useEffect(() => onItems(items), [items, onItems]);
  return (
    <Command
      shouldFilter={false}
      value={activeId}
      onValueChange={onActiveChange}
      label="Chọn người được nhắc"
      className="border-border-default bg-bg-surface max-h-48 rounded-[var(--r-sm)] border"
    >
      <CommandList>
        {search.isPending && <p className={`text-ink-tertiary ${ROW}`}>Đang tìm…</p>}
        {search.isError && (
          <p role="alert" className={`text-danger ${ROW}`}>
            Không tải được danh sách nhân viên.
          </p>
        )}
        {search.isSuccess && items.length === 0 && (
          <p className={`text-ink-tertiary ${ROW}`}>Không có nhân viên khớp.</p>
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
                {person.roleName && <span className="text-ink-tertiary"> — {person.roleName}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}
