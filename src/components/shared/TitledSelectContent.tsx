"use client";

import { SelectContent, SelectGroup, SelectLabel } from "@/components/ui/select";

import type { ComponentProps, ReactNode } from "react";

/** Style dòng tiêu đề đầu dropdown — dùng chung cho Select và combobox (Popover + Command). */
const DROPDOWN_TITLE_CLASS =
  "text-ink-tertiary border-border-default mb-1 border-b px-2 pt-1.5 pb-2 text-xs font-medium";

interface TitledSelectContentProps extends ComponentProps<typeof SelectContent> {
  /** Tiêu đề ngắn ở đầu danh sách — như tiêu đề popover của toolbar ("Lọc trạng thái"). */
  title: string;
  children: ReactNode;
}

/**
 * `SelectContent` có tiêu đề: mọi dropdown chọn một trong app mở ra đều có dòng tiêu đề ở đầu, đồng
 * bộ với popover công cụ của bảng. Không chứa nghiệp vụ — nhận tiêu đề qua props.
 */
export function TitledSelectContent({ title, children, ...props }: TitledSelectContentProps) {
  return (
    <SelectContent {...props}>
      <SelectGroup>
        <SelectLabel className={DROPDOWN_TITLE_CLASS}>{title}</SelectLabel>
        {children}
      </SelectGroup>
    </SelectContent>
  );
}

/** Dòng tiêu đề đầu combobox (Popover + Command) — cùng dáng với `TitledSelectContent`. */
export function DropdownTitle({ children }: { children: ReactNode }) {
  return <div className={`${DROPDOWN_TITLE_CLASS} mb-0`}>{children}</div>;
}
