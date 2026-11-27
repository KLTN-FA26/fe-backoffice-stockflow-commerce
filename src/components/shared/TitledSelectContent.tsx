"use client";

import { SelectContent } from "@/components/shared/combobox-select";

import type { ComponentProps, ReactNode } from "react";

/** Style dòng tiêu đề đầu dropdown — cùng dáng tiêu đề cột của bảng "Bộ lọc". */
const DROPDOWN_TITLE_CLASS = "text-ink-primary px-2 pt-1.5 pb-1 text-sm font-semibold";

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
    <SelectContent title={title} {...props}>
      {children}
    </SelectContent>
  );
}

/** Dòng tiêu đề đầu combobox (Popover + Command) — cùng dáng với `TitledSelectContent`. */
export function DropdownTitle({ children }: { children: ReactNode }) {
  return <div className={DROPDOWN_TITLE_CLASS}>{children}</div>;
}
