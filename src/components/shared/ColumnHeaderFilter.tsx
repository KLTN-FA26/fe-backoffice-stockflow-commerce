"use client";

import { cn } from "cn";
import { Filter } from "lucide-react";

import { LIST_TOOLBAR_LIMITS } from "@/constants";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { DatePicker } from "./DatePicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import type { ReactNode } from "react";
import type { ColumnDef } from "./DataTable";

/** Ô "Tìm…" trong danh sách chọn chỉ cần khi có nhiều mục (≤ 10 mục nhìn một lượt là thấy hết) — cùng ngưỡng với `ListToolbar`. */
const needsSearch = (count: number) => count > LIST_TOOLBAR_LIMITS.listSearchMin;

/**
 * Nút lọc nhỏ cạnh tên cột (data-table-mode-a §4 "Tìm trong cột"): bấm mở popover chứa ô lọc; đang lọc → icon
 * tone `info`. Đặt vào `ColumnDef.headerFilter`. Không chứa nghiệp vụ — nội dung popover do caller truyền.
 */
export function HeaderFilterPopover({
  label,
  active,
  onClear,
  className,
  children,
}: {
  label: string;
  active: boolean;
  /** Có thì hiện nút `Xoá` cuối popover (khoá khi chưa lọc). */
  onClear?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Lọc ${label}`}
          className={cn(
            "text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary size-6 shrink-0 rounded-[var(--r-sm)] focus-visible:ring-0",
            active && "bg-info/10 text-info hover:bg-info/10 hover:text-info",
          )}
        >
          <Filter className="size-3.5" />
        </Button>
      </PopoverTrigger>
      {/* Cùng dáng một cột của bảng "Bộ lọc": tiêu đề đậm + "Xoá" bên phải, nội dung không có khung lồng */}
      <PopoverContent align="start" className={cn("w-64 gap-0 px-1.5 py-2", className)}>
        <div className="flex items-center justify-between gap-2 px-2 pb-1">
          <p className="text-ink-primary text-sm font-semibold">Lọc {label}</p>
          {onClear && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onClear}
              disabled={!active}
              className="text-ink-tertiary hover:text-ink-primary"
            >
              Xoá
            </Button>
          )}
        </div>
        {children}
      </PopoverContent>
    </Popover>
  );
}

/** Lọc chữ trong cột: ô input trong popover, gõ là lọc. */
export function ColumnFilterButton({
  value,
  label,
  placeholder,
  onChange,
}: {
  value: string;
  label: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <HeaderFilterPopover label={label} active={Boolean(value.trim())} onClear={() => onChange("")}>
      <div className="px-1 pt-1">
        <Input
          value={value}
          placeholder={placeholder}
          aria-label={placeholder}
          autoFocus
          onChange={(event) => onChange(event.target.value)}
          className="bg-bg-surface h-8 text-[0.8125rem]"
        />
      </div>
    </HeaderFilterPopover>
  );
}

export interface HeaderFilterOption {
  value: string;
  label: string;
}

/** Không cho auto-highlight của cmdk trông như đã chọn (data-table-mode-a §7) — checkbox là tín hiệu duy nhất. */
const ITEM_CLASS =
  "data-selected:bg-bg-muted/60 data-selected:text-ink-primary gap-2 text-[0.8125rem]";

/**
 * Lọc MỘT giá trị trong cột (BE nhận một id): gõ vào ô để tìm trong danh sách lựa chọn, bấm để chọn, bấm lại để
 * bỏ. Cùng dáng công cụ lọc của toolbar (Popover + Command + Checkbox).
 */
export function HeaderOptionFilter({
  label,
  value,
  options,
  onChange,
  searchPlaceholder,
  emptyLabel,
}: {
  label: string;
  value: string | null;
  options: readonly HeaderFilterOption[];
  onChange: (value: string | null) => void;
  searchPlaceholder: string;
  emptyLabel: string;
}) {
  return (
    <HeaderFilterPopover
      label={label}
      active={value !== null}
      onClear={() => onChange(null)}
      className="w-72"
    >
      <Command className="h-auto rounded-none! bg-transparent p-0">
        {needsSearch(options.length) && <CommandInput placeholder={searchPlaceholder} autoFocus />}
        <CommandList className="max-h-64 pt-1">
          <CommandEmpty>{emptyLabel}</CommandEmpty>
          <CommandGroup>
            {options.map((option) => {
              const checked = option.value === value;
              return (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label]}
                  onSelect={() => onChange(checked ? null : option.value)}
                  className={ITEM_CLASS}
                >
                  <Checkbox
                    checked={checked}
                    tabIndex={-1}
                    aria-hidden
                    className="pointer-events-none"
                  />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </HeaderFilterPopover>
  );
}

/**
 * Lọc NHIỀU giá trị trong cột (BE nhận danh sách, vd trạng thái): tick / bỏ tick từng giá trị, popover
 * vẫn mở. Cùng dáng `HeaderOptionFilter`.
 */
export function HeaderMultiOptionFilter({
  label,
  values,
  options,
  onToggle,
  onClear,
  searchPlaceholder,
  emptyLabel,
}: {
  label: string;
  values: readonly string[];
  options: readonly HeaderFilterOption[];
  onToggle: (value: string) => void;
  onClear: () => void;
  searchPlaceholder: string;
  emptyLabel: string;
}) {
  return (
    <HeaderFilterPopover
      label={label}
      active={values.length > 0}
      onClear={onClear}
      className="w-72"
    >
      <Command className="h-auto rounded-none! bg-transparent p-0">
        {needsSearch(options.length) && <CommandInput placeholder={searchPlaceholder} autoFocus />}
        <CommandList className="max-h-64 pt-1">
          <CommandEmpty>{emptyLabel}</CommandEmpty>
          <CommandGroup>
            {options.map((option) => {
              const checked = values.includes(option.value);
              return (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label]}
                  onSelect={() => onToggle(option.value)}
                  className={ITEM_CLASS}
                >
                  <Checkbox
                    checked={checked}
                    tabIndex={-1}
                    aria-hidden
                    className="pointer-events-none"
                  />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </HeaderFilterPopover>
  );
}

/**
 * Lọc theo khoảng ngày trong cột thời gian: "Từ ngày" – "Đến ngày" (`YYYY-MM-DD`, rỗng = không chặn
 * đầu đó). Ngày đến không chọn được trước ngày từ và ngược lại.
 */
export function HeaderDateRangeFilter({
  label,
  from,
  to,
  onChange,
  quickKind,
}: {
  label: string;
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  /** Nút chọn nhanh trong lịch: `past` cho cột ngày đã xảy ra (ngày đặt, ngày tạo, lịch sử) — không gợi ý ngày tương lai. */
  quickKind?: "past" | "future";
}) {
  return (
    <HeaderFilterPopover
      label={label}
      active={Boolean(from || to)}
      onClear={() => onChange({ from: "", to: "" })}
      className="w-72"
    >
      <div className="grid gap-2 px-1 pt-1">
        <label className="grid gap-1">
          <span className="text-ink-tertiary text-xs">Từ ngày</span>
          <DatePicker
            value={from}
            max={to || undefined}
            onChange={(value) => onChange({ from: value, to })}
            placeholder="Không giới hạn"
            quickKind={quickKind}
            clearable
          />
        </label>
        <label className="grid gap-1">
          <span className="text-ink-tertiary text-xs">Đến ngày</span>
          <DatePicker
            value={to}
            min={from || undefined}
            onChange={(value) => onChange({ from, to: value })}
            placeholder="Không giới hạn"
            quickKind={quickKind}
            clearable
          />
        </label>
      </div>
    </HeaderFilterPopover>
  );
}

/**
 * Lọc theo khoảng số trong cột số lượng / tiền: "Từ" – "Đến" (chuỗi chữ số, rỗng = không chặn đầu đó). Chỉ nhận chữ số —
 * caller tự so sánh (số lượng qua `Number`, tiền là chuỗi chữ số thì so theo chuỗi). Không chứa nghiệp vụ.
 */
export function HeaderNumberRangeFilter({
  label,
  from,
  to,
  onChange,
  unit,
}: {
  label: string;
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  /** Đơn vị hiện sau nhãn ô, vd "thùng", "₫". */
  unit?: string;
}) {
  const digits = (value: string) => value.replace(/\D/g, "");
  const field = (key: "from" | "to", text: string, value: string) => (
    <label className="grid gap-1">
      <span className="text-ink-tertiary text-xs">
        {text}
        {unit ? ` (${unit})` : ""}
      </span>
      <Input
        value={value}
        inputMode="numeric"
        placeholder="Không giới hạn"
        aria-label={`${text} — ${label}`}
        onChange={(event) => {
          const next = digits(event.target.value);
          onChange(key === "from" ? { from: next, to } : { from, to: next });
        }}
        className="bg-bg-surface h-8 text-[0.8125rem] tabular-nums"
      />
    </label>
  );
  return (
    <HeaderFilterPopover
      label={label}
      active={Boolean(from || to)}
      onClear={() => onChange({ from: "", to: "" })}
      className="w-72"
    >
      <div className="grid grid-cols-2 gap-2 px-1 pt-1">
        {field("from", "Từ", from)}
        {field("to", "Đến", to)}
      </div>
    </HeaderFilterPopover>
  );
}

/** Gắn nút lọc vào header các cột theo `key` (cột không có trong map giữ nguyên). */
export function withHeaderFilters<T>(
  columns: ColumnDef<T>[],
  filters?: Partial<Record<string, ReactNode>>,
): ColumnDef<T>[] {
  if (!filters) return columns;
  return columns.map((col) =>
    filters[col.key] ? { ...col, headerFilter: filters[col.key] } : col,
  );
}
