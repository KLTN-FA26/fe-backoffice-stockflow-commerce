"use client";

import { Columns3, RotateCcw, Settings2 } from "lucide-react";

import { FULFILLMENT_COLUMNS, UI_LABELS } from "@/constants";
import { Badge } from "@/components/ui/badge";
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
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

import { ALL_COLUMNS, COLUMN_LABELS } from "./constants";
import { FilterBadge } from "./FilterBadge";

import type { TaskFilterLabels } from "./useTaskFilterLabels";
import type { TaskListState } from "./useTaskListState";

const COLUMN_OPTIONS = ALL_COLUMNS.filter((c) => c !== FULFILLMENT_COLUMNS.ACTIONS);
const TOOL_BUTTON =
  "border-border-default bg-bg-surface text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary rounded-[var(--r-sm)] focus-visible:ring-0";
const TOOL_BUTTON_ACTIVE =
  "border-warning bg-warning/10 text-warning hover:bg-warning/10 hover:text-warning";
const F = UI_LABELS.fulfillment.filter;

/**
 * Thanh cấu hình của danh sách task (data-table-mode-a §2–§3, bản rút gọn). `ListToolbar` dùng
 * chung bắt buộc có ô tìm kiếm — BE không có tìm kiếm task, nên ở đây là phạm vi dữ liệu (BE quyết
 * theo mã quyền), bộ lọc đang bật (mỗi badge xoá riêng được), ẩn/hiện cột. "Đặt lại" xoá cả lọc lẫn cột.
 */
export function TaskListToolbar({
  s,
  scopeNote,
  labels,
}: {
  s: TaskListState;
  scopeNote: string;
  labels: TaskFilterLabels;
}) {
  const visible = s.config.visibleColumns;
  const canReset = s.hasColumnConfig || s.hasFilters;
  return (
    <div className="border-border-default mb-4 flex flex-wrap items-center gap-2 rounded-(--section-radius) border bg-(--summary-bg) px-3 py-2 text-[0.8125rem] shadow-(--card-shadow)">
      <div className="text-ink-primary mr-1 flex items-center gap-2 font-medium">
        <Settings2 className="text-accent size-3.5" />
        Cấu hình
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap gap-2">
        <Badge variant="outline" className="bg-bg-subtle text-ink-secondary">
          Phạm vi: {scopeNote}
        </Badge>
        {labels.status && (
          <FilterBadge label={F.status} value={labels.status} onClear={() => s.setStatus(null)} />
        )}
        {labels.warehouse && (
          <FilterBadge
            label={F.warehouse}
            value={labels.warehouse}
            onClear={() => s.setWarehouse(null)}
          />
        )}
        {labels.assignee && (
          <FilterBadge
            label={F.assignee}
            value={labels.assignee}
            onClear={() => s.setAssignee(null)}
          />
        )}
        <Badge variant="outline" className="bg-bg-subtle text-ink-secondary">
          Cột hiển thị: {s.visibleColumnCount}/{COLUMN_OPTIONS.length}
        </Badge>
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Ẩn hiện cột"
            className={`${TOOL_BUTTON} ${s.hasColumnConfig ? TOOL_BUTTON_ACTIVE : ""}`}
          >
            <Columns3 className={s.hasColumnConfig ? "size-3.5" : "text-dot-warning size-3.5"} />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <PopoverHeader className="border-border-default border-b p-3">
            <PopoverTitle>Ẩn hiện cột</PopoverTitle>
            <PopoverDescription>Chọn các cột muốn thấy trên bảng.</PopoverDescription>
          </PopoverHeader>
          <Command>
            <CommandInput placeholder="Tìm cột..." />
            <CommandList>
              <CommandEmpty>Không có cột phù hợp.</CommandEmpty>
              <CommandGroup>
                {COLUMN_OPTIONS.map((column) => {
                  const checked = visible.includes(column);
                  const disabled = checked && s.visibleColumnCount <= 1;
                  return (
                    <CommandItem
                      key={column}
                      value={COLUMN_LABELS[column] ?? column}
                      disabled={disabled}
                      onSelect={() => s.toggleColumn(column)}
                      className="hover:bg-bg-muted/60 hover:text-ink-primary data-selected:text-ink-secondary data-selected:bg-transparent"
                    >
                      <Checkbox checked={checked} disabled={disabled} />
                      <span>{COLUMN_LABELS[column] ?? column}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => {
          s.resetColumns();
          s.clearFilters();
        }}
        disabled={!canReset}
        className="text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary rounded-[var(--r-sm)]"
      >
        <RotateCcw className="size-3" />
        Đặt lại
      </Button>
    </div>
  );
}
