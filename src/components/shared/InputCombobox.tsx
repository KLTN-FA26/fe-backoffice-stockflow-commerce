"use client";

import { useId, useRef, useState } from "react";
import { Command as CommandPrimitive, useCommandState } from "cmdk";
import { cn } from "cn";
import { ChevronDown } from "lucide-react";

import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

import type { KeyboardEvent, ReactNode } from "react";

/** Class `CommandItem` trong combobox: dòng đang highlight theo ↑/↓ (`data-selected`) nền muted nhẹ. */
export const COMBOBOX_ITEM_CLASS = "data-selected:bg-bg-muted data-selected:text-ink-primary";

interface InputComboboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chữ hiện trong ô khi đóng — nhãn của giá trị đang chọn ("" = chưa chọn). */
  displayValue: string;
  placeholder: string;
  /** Placeholder khi đang gõ tìm và chưa chọn gì. */
  searchPlaceholder: string;
  ariaLabel: string;
  /** Có thì ô tìm do caller giữ (vd BE lọc theo `q`); không thì giữ nội bộ. */
  search?: string;
  onSearchChange?: (search: string) => void;
  /** `false` khi caller tự lọc (BE lọc) — tắt lọc phía cmdk. */
  shouldFilter?: boolean;
  id?: string;
  hasError?: boolean;
  describedBy?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Chữ mono khi đã chọn (mã SKU…). */
  mono?: boolean;
  onBlur?: () => void;
  contentClassName?: string;
  /** Nội dung dropdown: `CommandList` + item của caller. */
  children: ReactNode;
}

/**
 * Combobox gõ thẳng vào ô (kiểu Combobox của shadcn): ô input là trigger, gõ để lọc, danh sách
 * xổ ngay dưới; ↑/↓ chọn, Enter xác nhận, Esc đóng. Không chứa nghiệp vụ — option do caller render
 * bằng `CommandItem`.
 */
export function InputCombobox(props: InputComboboxProps) {
  const [innerSearch, setInnerSearch] = useState("");
  const search = props.search ?? innerSearch;
  const setSearch = props.onSearchChange ?? setInnerSearch;
  return (
    <CommandPrimitive shouldFilter={props.shouldFilter} loop className="w-full">
      {/* cmdk chỉ lọc theo search của `Command.Input` — ô ẩn này đồng bộ search, ô thật ở dưới */}
      <CommandPrimitive.Input value={search} hidden readOnly tabIndex={-1} />
      <ComboboxField {...props} search={search} setSearch={setSearch} />
    </CommandPrimitive>
  );
}

function ComboboxField({
  open,
  onOpenChange,
  displayValue,
  placeholder,
  searchPlaceholder,
  ariaLabel,
  search,
  setSearch,
  id,
  hasError,
  describedBy,
  disabled,
  autoFocus,
  mono,
  onBlur,
  contentClassName,
  children,
}: InputComboboxProps & { search: string; setSearch: (search: string) => void }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const activeId = useCommandState((state) => state.selectedItemId);

  const setOpen = (next: boolean) => {
    if (next === open) return;
    // Mở ra luôn bắt đầu từ ô trống — thấy đủ danh sách, giá trị đang chọn nằm ở placeholder
    if (next) setSearch("");
    onOpenChange(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (open) return; // ↑/↓/Enter do cmdk xử lý ở thẻ gốc
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
      // Enter không submit form khi danh sách đang đóng — mở danh sách như bấm vào ô
      e.preventDefault();
      setOpen(true);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          ref={anchorRef}
          className={cn(
            "bg-bg-surface relative flex h-8 w-full items-center rounded-[var(--r-sm)] border transition-colors",
            "has-disabled:bg-bg-muted has-disabled:cursor-not-allowed",
            hasError
              ? "border-danger focus-within:ring-danger/20 focus-within:ring-3"
              : "border-border-default focus-within:border-brand focus-within:ring-brand/20 focus-within:ring-3",
          )}
        >
          <input
            ref={inputRef}
            id={id}
            type="text"
            role="combobox"
            autoComplete="off"
            spellCheck={false}
            aria-label={ariaLabel}
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={open ? activeId : undefined}
            aria-invalid={hasError ? true : undefined}
            aria-describedby={describedBy}
            disabled={disabled}
            autoFocus={autoFocus}
            value={open ? search : displayValue}
            placeholder={open ? displayValue || searchPlaceholder : placeholder}
            onChange={(e) => {
              setSearch(e.target.value);
              if (!open) onOpenChange(true);
            }}
            onClick={() => setOpen(true)}
            onKeyDown={onKeyDown}
            onBlur={() => {
              setOpen(false);
              onBlur?.();
            }}
            className={cn(
              "text-ink-primary placeholder:text-ink-tertiary h-full min-w-0 flex-1 truncate bg-transparent pr-7 pl-2.5 text-[0.8125rem] outline-none disabled:cursor-not-allowed",
              mono && !open && displayValue && "font-[family-name:var(--font-mono)]",
            )}
          />
          <ChevronDown
            aria-hidden
            onMouseDown={(e) => {
              // Bấm mũi tên = bấm vào ô: giữ focus ở ô input rồi bật/tắt danh sách
              e.preventDefault();
              if (disabled) return;
              inputRef.current?.focus();
              setOpen(!open);
            }}
            className={cn(
              "text-ink-tertiary absolute right-2 size-3.5 shrink-0 transition-transform",
              open && "rotate-180",
              !disabled && "cursor-pointer",
            )}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        id={listboxId}
        align="start"
        className={cn("w-(--radix-popover-trigger-width) gap-0 p-1", contentClassName)}
        // Focus ở lại ô input để gõ tiếp; bấm vào option không làm ô mất focus
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (e.target instanceof Node && anchorRef.current?.contains(e.target)) e.preventDefault();
        }}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
