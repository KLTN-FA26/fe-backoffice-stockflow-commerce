"use client";

import { cn } from "cn";
import { Filter } from "lucide-react";

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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import type { ReactNode } from "react";
import type { ColumnDef } from "./DataTable";

/**
 * Nút lọc nhỏ cạnh tên cột (data-table-mode-a §4 "Search trong cột"): bấm mở popover chứa ô lọc; đang lọc → icon
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
      <PopoverContent align="start" className={cn("w-64 p-3", className)}>
        <div className="text-ink-primary mb-2 text-xs font-medium">Lọc {label}</div>
        {children}
        {onClear && (
          <div className="mt-2 flex justify-end">
            <Button type="button" variant="outline" size="xs" onClick={onClear} disabled={!active}>
              Xoá
            </Button>
          </div>
        )}
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
      <Input
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus
        onChange={(event) => onChange(event.target.value)}
        className="bg-bg-surface h-8 rounded-[var(--r-sm)] text-[0.75rem]"
      />
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
      <Command className="border-border-default rounded-[var(--r-sm)] border">
        <CommandInput placeholder={searchPlaceholder} autoFocus />
        <CommandList className="max-h-56">
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
