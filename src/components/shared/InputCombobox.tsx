"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Command as CommandPrimitive, useCommandState } from "cmdk";
import { cn } from "cn";
import { ChevronDown, X } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

import type { KeyboardEvent, ReactNode } from "react";

const L = UI_LABELS.combobox;
const FIRST_ITEM = '[cmdk-item]:not([aria-disabled="true"])';
const SELECTED_ITEM = '[cmdk-item][data-selected="true"]';

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
  /** Có thì hiện nút ✕ bên phải khi đang giữ một giá trị — bấm xoá giá trị (caller đặt lại state về rỗng). */
  onClear?: () => void;
  onBlur?: () => void;
  contentClassName?: string;
  /** Nội dung dropdown: `CommandList` + item của caller. */
  children: ReactNode;
}

/**
 * Combobox gõ thẳng vào ô (kiểu Combobox của shadcn): ô input là trigger, danh sách xổ ngay dưới;
 * ↑/↓ chọn, Enter xác nhận, Esc đóng. Không chứa nghiệp vụ — option do caller render bằng `CommandItem`.
 *
 * Luật mở (R1, WF4 UX audit): danh sách CHỈ mở khi người dùng gõ ≥ 1 ký tự hoặc bấm nút mũi tên (hoặc Alt+↓).
 * Bấm vào thân ô, Enter, ↑/↓ không mở — bấm chỉ đặt con trỏ. Giá trị đang chọn giữ nguyên trong ô (không bị xoá khi
 * mở); `onClear` thêm nút ✕ để bỏ chọn. Danh sách dài: caller cắt còn `COMBOBOX_MAX_ROWS` dòng + `ComboboxMoreHint`.
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
  onClear,
  onBlur,
  contentClassName,
  children,
}: InputComboboxProps & { search: string; setSearch: (search: string) => void }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const activeId = useCommandState((state) => state.selectedItemId);

  // Mở bằng nút mũi tên (ô tìm còn trống) — xoá hết chữ đã gõ thì danh sách vẫn mở; mở bằng gõ thì đóng lại
  const openedByButton = useRef(false);
  useEffect(() => {
    if (!open) openedByButton.current = false;
  }, [open]);

  const setOpen = (next: boolean) => {
    if (next === open) return;
    onOpenChange(next);
  };

  /** Mở danh sách bằng nút mũi tên / Alt+↓: bắt đầu từ ô tìm trống — thấy đủ danh sách, giá trị đang chọn nằm ở placeholder. */
  const openFromButton = () => {
    if (disabled || open) return;
    openedByButton.current = true;
    setSearch("");
    onOpenChange(true);
  };

  const onType = (typed: string) => {
    // Ô đang đóng và giữ một giá trị: chữ trong ô là tên đang chọn + ký tự vừa gõ → chỉ lấy phần gõ thêm làm từ khoá
    const next =
      !open && displayValue && typed.includes(displayValue)
        ? typed.replace(displayValue, "")
        : typed;
    setSearch(next);
    if (next !== "") {
      if (!open) onOpenChange(true);
    } else if (open && !openedByButton.current) {
      onOpenChange(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (open) {
      // ↑/↓/Enter do cmdk xử lý ở thẻ gốc. Riêng khi gõ thẳng vào ô đang đóng (bàn phím / máy quét), danh sách
      // vừa mở có thể chưa có mục nào được đánh dấu → Enter của cmdk không làm gì; khi đó chọn mục đầu khớp.
      if (e.key === "Enter") {
        const list = document.getElementById(listboxId);
        const first = list?.querySelector<HTMLElement>(FIRST_ITEM);
        if (first && !list?.querySelector(SELECTED_ITEM)) {
          e.preventDefault();
          first.click();
        }
      }
      return;
    }
    // Danh sách đóng: Enter không submit form (người dùng lớn tuổi hay bấm nhầm); ↑/↓ không mở — chỉ Alt+↓ (chuẩn
    // ARIA combobox) cho người dùng bàn phím xem danh sách mà chưa gõ gì
    if (e.key === "Enter") e.preventDefault();
    else if (e.key === "ArrowDown" && e.altKey) {
      e.preventDefault();
      openFromButton();
    }
  };

  const showClear = !!onClear && displayValue !== "" && !open && !disabled;

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
            onChange={(e) => onType(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => {
              setOpen(false);
              onBlur?.();
            }}
            className={cn(
              "text-ink-primary placeholder:text-ink-tertiary h-full min-w-0 flex-1 truncate bg-transparent pl-2.5 text-[0.8125rem] outline-none disabled:cursor-not-allowed",
              showClear ? "pr-14" : "pr-7",
              mono && !open && displayValue && "font-[family-name:var(--font-mono)]",
            )}
          />
          {showClear && (
            <button
              type="button"
              tabIndex={-1}
              aria-label={L.clear(ariaLabel)}
              // Giữ focus ở ô input: bấm ✕ xong gõ tiếp được ngay
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onClear?.();
                inputRef.current?.focus();
              }}
              className="text-ink-tertiary hover:text-ink-primary absolute right-7 grid size-5 place-items-center rounded-sm"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            aria-label={L.open(ariaLabel)}
            aria-expanded={open}
            // Bấm mũi tên: giữ focus ở ô input rồi bật/tắt danh sách
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              inputRef.current?.focus();
              if (open) setOpen(false);
              else openFromButton();
            }}
            className={cn(
              "text-ink-tertiary absolute right-1.5 grid size-5 place-items-center rounded-sm",
              !disabled && "hover:text-ink-primary cursor-pointer",
            )}
          >
            <ChevronDown
              aria-hidden
              className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")}
            />
          </button>
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

/**
 * Dòng cuối danh sách khi kết quả nhiều hơn số dòng hiện (R1): "Còn N kết quả — gõ thêm". Caller cắt danh sách còn
 * `COMBOBOX_MAX_ROWS` dòng và truyền số còn lại; `remaining` bỏ trống khi BE chỉ báo còn trang sau (không có tổng).
 * `label` cho caller muốn danh từ riêng ("Còn N khách — gõ thêm…").
 */
export function ComboboxMoreHint({ remaining, label }: { remaining?: number; label?: string }) {
  if (remaining !== undefined && remaining <= 0) return null;
  return (
    <p className="text-ink-tertiary border-border-default border-t px-3 py-1.5 text-xs">
      {label ?? (remaining === undefined ? L.moreUnknown : L.more(remaining))}
    </p>
  );
}
