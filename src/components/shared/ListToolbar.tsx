"use client";

import { cn } from "cn";
import { Columns3, FileDown, Filter, ListFilter, Search, X } from "lucide-react";
import { LIST_TOOLBAR_LIMITS, UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { ListConfigSummary, type ListSummaryItem } from "./ListConfigSummary";

import type { ReactNode } from "react";

export type { ListSummaryItem };

const L = UI_LABELS.listToolbar;
/** Ô "Tìm…" trong danh sách chọn chỉ cần khi có nhiều mục (≤ 10 mục nhìn một lượt là thấy hết). */
const needsSearch = (count: number) => count > LIST_TOOLBAR_LIMITS.listSearchMin;

export interface ListOption<T extends string> {
  label: string;
  value: T;
}

export interface ListToolbarProps<
  Status extends string,
  Field extends string,
  Column extends string,
> {
  /**
   * Tìm kiếm chính. Bỏ cả ba khi BE không có tham số tìm cho danh sách phân trang phía server (lọc FE chỉ thấy trang
   * đang tải — gây hiểu sai): toolbar khi đó chỉ còn công cụ lọc / cột / hành động.
   */
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  statusOptions?: ListOption<Status>[];
  selectedStatuses?: Status[];
  onToggleStatus?: (status: Status) => void;
  onClearStatuses?: () => void;
  hasStatusFilter?: boolean;
  fieldOptions?: ListOption<Field>[];
  selectedFields?: Field[];
  defaultFields?: Field[];
  onToggleField?: (field: Field) => void;
  onResetFields?: () => void;
  onSelectAllFields?: () => void;
  hasFieldConfig?: boolean;
  columnOptions?: ListOption<Column>[];
  selectedColumns?: Column[];
  defaultColumns?: Column[];
  lockedColumns?: Column[];
  visibleColumnCount?: number;
  onToggleColumn?: (column: Column) => void;
  onResetColumns?: () => void;
  hasColumnConfig?: boolean;
  selectedCount?: number;
  bulkDeleteLabel?: string;
  onBulkDelete?: () => void;
  exportLabel?: string;
  /** Không truyền → ẩn nút xuất (vd người dùng thiếu quyền xuất dữ liệu). */
  onExport?: () => void;
  summaryItems: ListSummaryItem[];
  /**
   * Một dòng chữ nhỏ dưới toolbar, LUÔN hiện — thông tin chỉ để đọc về danh sách (vd "Phạm vi: task được gán cho bạn").
   * Không đặt vào thanh `Cấu hình`: thanh đó chỉ hiện khi có bộ lọc đang bật.
   */
  note?: ReactNode;
  /** Hàng facet nghiệp vụ dưới toolbar (kho, vị trí, loại…) — chỉ trang có bộ lọc thêm. */
  facets?: ReactNode;
  /** Công cụ riêng của trang (vd mở / thu gọn cây) — đặt sau các icon công cụ, dùng `ToolbarIconButton`. */
  tools?: ReactNode;
  /**
   * Nút hành động của trang (vd Tạo mới, Hiện thống kê) — góc phải, sau nút xuất. Dùng
   * `TOOLBAR_ACTION_CLASS` để cùng cỡ với nút xuất.
   */
  actions?: ReactNode;
  onResetAll: () => void;
  resetDisabled?: boolean;
}

/** Cỡ nút hành động trên toolbar — cao/bo góc theo biến CSS `--action-*` (`.surface-soft` đổi). */
export const TOOLBAR_ACTION_CLASS =
  "h-(--action-h) gap-1.5 rounded-(--action-radius) px-(--action-px) text-[0.8125rem] shadow-(--control-shadow)";

/** Màu nút hành động chính trên toolbar (Tạo mới) — đi kèm `TOOLBAR_ACTION_CLASS`. */
export const TOOLBAR_PRIMARY_CLASS =
  "bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse";

/** Nút icon công cụ của toolbar (cùng dáng nút Lọc / Ẩn hiện cột) — nhãn nằm ở tooltip. */
export function ToolbarIconButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
          className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary size-(--control-size) rounded-(--control-radius) shadow-(--control-shadow) focus-visible:ring-0"
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Công tắc bật / tắt một bộ lọc có hai trạng thái (vd "Chỉ cảnh báo") hiện sẵn trên thanh — một lần bấm, không phải mở
 * danh sách. `role="switch"`, bật thì viền + nền tông info như các công cụ lọc khác.
 */
export function ToolbarSwitch({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary focus-visible:ring-brand/30 inline-flex h-(--control-size) items-center gap-2 rounded-(--control-radius) border px-3 text-[0.8125rem] shadow-(--control-shadow) outline-none focus-visible:ring-2",
        checked && "border-info bg-info/10 text-info hover:bg-info/10 hover:text-info",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative h-4 w-7 shrink-0 rounded-full transition-colors",
          checked ? "bg-info" : "bg-border-strong",
        )}
      >
        <span
          className={cn(
            "bg-bg-surface absolute top-0.5 left-0.5 size-3 rounded-full transition-transform",
            checked && "translate-x-3",
          )}
        />
      </span>
      {label}
    </button>
  );
}

/**
 * Hai đến bốn trạng thái → nút chọn nhanh hiện sẵn trên thanh (một lần bấm), thay cho biểu tượng phễu + khung có ô tìm.
 * Bấm nút đang chọn gọi `onToggle` như hộp tích — trang tự quyết "chọn một" hay "chọn nhiều".
 */
function StatusQuickPicks<Status extends string>({
  options,
  selected,
  onToggle,
}: {
  options: ListOption<Status>[];
  selected: Status[];
  onToggle: (status: Status) => void;
}) {
  return (
    <div
      role="group"
      aria-label={L.status}
      className="border-border-default bg-bg-surface inline-flex h-(--control-size) items-center gap-0.5 rounded-(--control-radius) border p-0.5 shadow-(--control-shadow)"
    >
      {options.map((option) => {
        const on = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(option.value)}
            className={cn(
              "focus-visible:ring-brand/30 h-full rounded-[calc(var(--control-radius)-2px)] px-3 text-[0.8125rem] whitespace-nowrap outline-none focus-visible:ring-2",
              on
                ? "bg-info/10 text-info font-medium"
                : "text-ink-secondary hover:bg-bg-muted hover:text-ink-primary",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function commandItemClassName() {
  return "data-selected:bg-transparent data-selected:text-ink-secondary hover:bg-bg-muted/60 hover:text-ink-primary";
}

export function ListToolbar<Status extends string, Field extends string, Column extends string>({
  search,
  onSearchChange,
  searchPlaceholder,
  statusOptions,
  selectedStatuses = [],
  onToggleStatus,
  onClearStatuses,
  hasStatusFilter = false,
  fieldOptions,
  selectedFields = [],
  defaultFields = [],
  onToggleField,
  onResetFields,
  onSelectAllFields,
  hasFieldConfig = false,
  columnOptions,
  selectedColumns = [],
  defaultColumns = [],
  lockedColumns = [],
  visibleColumnCount,
  onToggleColumn,
  onResetColumns,
  hasColumnConfig = false,
  selectedCount = 0,
  bulkDeleteLabel = L.bulkDelete,
  onBulkDelete,
  exportLabel = L.export,
  onExport,
  summaryItems,
  note,
  facets,
  tools,
  actions,
  onResetAll,
  resetDisabled = false,
}: ListToolbarProps<Status, Field, Column>) {
  const canUseStatus = Boolean(statusOptions?.length && onToggleStatus);
  // 2–4 trạng thái: nút chọn nhanh hiện sẵn; nhiều hơn mới là biểu tượng phễu + khung chọn
  const statusInline =
    canUseStatus &&
    statusOptions!.length >= 2 &&
    statusOptions!.length <= LIST_TOOLBAR_LIMITS.statusInlineMax;
  const canUseFields = Boolean(fieldOptions?.length && onToggleField);
  const canUseColumns = Boolean(columnOptions?.length && onToggleColumn);

  return (
    <TooltipProvider>
      <div className="mb-3 rounded-(--section-radius) border border-(--toolbar-frame-border) bg-(--toolbar-bg) px-(--toolbar-pad-x) py-(--toolbar-pad-y) shadow-(--toolbar-frame-shadow)">
        <div className="flex flex-wrap items-center gap-2">
          {onSearchChange && searchPlaceholder && (
            <div className="relative min-w-[280px] flex-1 lg:max-w-(--toolbar-search-max)">
              <Search className="text-accent pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
              <Input
                value={search ?? ""}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="border-border-default bg-bg-surface focus-visible:border-brand focus-visible:ring-brand/20 h-(--control-h) rounded-(--control-radius) pl-9 text-(length:--control-text) shadow-(--control-shadow)"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            {statusInline && (
              <StatusQuickPicks
                options={statusOptions!}
                selected={selectedStatuses}
                onToggle={onToggleStatus!}
              />
            )}
            {canUseStatus && !statusInline && (
              <Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={L.status}
                        className={cn(
                          "border-border-default bg-bg-surface text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary size-(--control-size) rounded-(--control-radius) shadow-(--control-shadow) focus-visible:ring-0",
                          hasStatusFilter &&
                            "border-info bg-info/10 text-info hover:bg-info/10 hover:text-info",
                        )}
                      >
                        <Filter
                          className={cn(
                            "text-dot-info size-3.5",
                            hasStatusFilter && "text-current",
                          )}
                        />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>{L.status}</TooltipContent>
                </Tooltip>
                <PopoverContent align="end" className="w-80 p-0">
                  <PopoverHeader className="border-border-default border-b p-3">
                    <PopoverTitle>{L.status}</PopoverTitle>
                    <PopoverDescription>{L.statusHint}</PopoverDescription>
                  </PopoverHeader>
                  <Command>
                    {needsSearch(statusOptions!.length) && (
                      <CommandInput placeholder={L.statusSearch} />
                    )}
                    <CommandList>
                      <CommandEmpty>{L.statusNone}</CommandEmpty>
                      <CommandGroup>
                        {statusOptions!.map((option) => (
                          <CommandItem
                            key={option.value}
                            value={option.label}
                            onSelect={() => onToggleStatus!(option.value)}
                            className={commandItemClassName()}
                          >
                            <Checkbox checked={selectedStatuses.includes(option.value)} />
                            <span>{option.label}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                  <div className="border-border-default flex justify-between gap-2 border-t p-2">
                    <Button type="button" variant="outline" size="sm" onClick={onClearStatuses}>
                      {L.clearFilter}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {canUseFields && (
              <Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={L.searchBy}
                        className={cn(
                          "border-border-default bg-bg-surface text-ink-tertiary hover:bg-special/5 hover:text-special focus-visible:border-border-default data-[state=open]:border-border-default data-[state=open]:bg-bg-surface data-[state=open]:text-ink-tertiary size-(--control-size) rounded-(--control-radius) shadow-(--control-shadow) focus-visible:ring-0",
                          hasFieldConfig &&
                            "border-special bg-special/10 text-special hover:border-special hover:bg-special/10 hover:text-special data-[state=open]:border-special data-[state=open]:bg-special/10 data-[state=open]:text-special",
                        )}
                      >
                        <ListFilter
                          className={cn(
                            "text-dot-special size-3.5",
                            hasFieldConfig && "text-current",
                          )}
                        />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>{L.searchBy}</TooltipContent>
                </Tooltip>
                <PopoverContent align="end" className="w-[25rem] p-0">
                  <PopoverHeader className="border-border-default border-b p-3">
                    <PopoverTitle>{L.searchBy}</PopoverTitle>
                    <PopoverDescription>{L.searchByHint}</PopoverDescription>
                  </PopoverHeader>
                  <Command>
                    {needsSearch(fieldOptions!.length) && (
                      <CommandInput placeholder={L.searchBySearch} />
                    )}
                    <CommandList>
                      <CommandEmpty>{L.searchByNone}</CommandEmpty>
                      <CommandGroup>
                        {fieldOptions!.map((option) => (
                          <CommandItem
                            key={option.value}
                            value={option.label}
                            onSelect={() => onToggleField!(option.value)}
                            className={commandItemClassName()}
                          >
                            <Checkbox checked={selectedFields.includes(option.value)} />
                            <span>{option.label}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                  <div className="border-border-default flex justify-between gap-2 border-t p-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onResetFields}
                      disabled={defaultFields.length === 0}
                    >
                      {L.searchByDefault}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={onSelectAllFields}>
                      {L.searchByAll}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {canUseColumns && (
              <Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={L.columns}
                        className={cn(
                          "border-border-default bg-bg-surface text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary size-(--control-size) rounded-(--control-radius) shadow-(--control-shadow) focus-visible:ring-0",
                          hasColumnConfig &&
                            "border-warning bg-warning/10 text-warning hover:bg-warning/10 hover:text-warning",
                        )}
                      >
                        <Columns3
                          className={cn(
                            "text-dot-warning size-3.5",
                            hasColumnConfig && "text-current",
                          )}
                        />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>{L.columns}</TooltipContent>
                </Tooltip>
                <PopoverContent align="end" className="w-80 p-0">
                  <PopoverHeader className="border-border-default border-b p-3">
                    <PopoverTitle>{L.columns}</PopoverTitle>
                    <PopoverDescription>{L.columnsHint}</PopoverDescription>
                  </PopoverHeader>
                  <Command>
                    {needsSearch(columnOptions!.length) && (
                      <CommandInput placeholder={L.columnsSearch} />
                    )}
                    <CommandList>
                      <CommandEmpty>{L.columnsNone}</CommandEmpty>
                      <CommandGroup>
                        {columnOptions!.map((option) => {
                          const locked = lockedColumns.includes(option.value);
                          const checked = selectedColumns.includes(option.value);
                          const disabled =
                            locked ||
                            (checked && (visibleColumnCount ?? selectedColumns.length) <= 1);
                          return (
                            <CommandItem
                              key={option.value}
                              value={option.label}
                              disabled={disabled}
                              onSelect={() => onToggleColumn!(option.value)}
                              className={commandItemClassName()}
                            >
                              <Checkbox checked={checked} disabled={disabled} />
                              <span>{option.label}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                  <div className="border-border-default flex justify-between gap-2 border-t p-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onResetColumns}
                      disabled={defaultColumns.length === 0}
                    >
                      {L.columnsShowAll}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {tools}
          </div>

          {/* Rỗng (trang không có nút xuất / hành động) → ẩn, để `gap` của hàng không chừa 8px thừa ở mép phải */}
          <div className="ml-auto flex items-center gap-2 empty:hidden">
            {selectedCount > 0 && onBulkDelete && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onBulkDelete}
                className="border-danger/20 bg-danger/5 text-danger hover:bg-danger/10 hover:text-danger rounded-[var(--r-sm)]"
              >
                <X className="size-3.5" />
                {bulkDeleteLabel}
              </Button>
            )}
            {onExport && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onExport}
                className={cn(
                  "border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted hover:text-ink-primary",
                  TOOLBAR_ACTION_CLASS,
                )}
              >
                <FileDown className="text-dot-positive size-3.5" />
                {exportLabel}
              </Button>
            )}
            {actions}
          </div>
        </div>
      </div>

      {facets && (
        <div className="border-border-default bg-bg-subtle mb-3 flex flex-wrap items-center gap-3 rounded-(--section-radius) border px-3 py-2">
          {facets}
        </div>
      )}
      {note && <p className="text-ink-tertiary mb-3 text-xs">{note}</p>}
      <ListConfigSummary
        items={summaryItems}
        onResetAll={onResetAll}
        resetDisabled={resetDisabled}
      />
    </TooltipProvider>
  );
}
