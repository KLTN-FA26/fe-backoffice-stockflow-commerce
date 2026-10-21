"use client";

import { cn } from "cn";
import { Filter } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { DATA_TYPE_LABEL } from "../attribute-labels";
import { ATTRIBUTE_DATA_TYPES } from "../attribute-schemas";

import type { AttributeDataType } from "../attribute-schemas";

export const ATTRIBUTE_ACTIVE_FILTERS = ["true", "false"] as const;
type ActiveFilter = (typeof ATTRIBUTE_ACTIVE_FILTERS)[number];

// Cùng nhãn cờ `active` với thương hiệu / danh mục — một nguồn duy nhất
export const ATTRIBUTE_ACTIVE_LABEL: Record<ActiveFilter, string> = {
  true: UI_LABELS.taxonomy.active,
  false: UI_LABELS.taxonomy.inactive,
};
const TITLE = "Lọc thuộc tính";
const ITEM_CLASS =
  "data-selected:bg-transparent data-selected:text-ink-secondary hover:bg-bg-muted/60 hover:text-ink-primary";

interface Props {
  dataType: AttributeDataType | null;
  active: ActiveFilter | null;
  onDataTypeChange: (value: AttributeDataType | null) => void;
  onActiveChange: (value: ActiveFilter | null) => void;
}

/**
 * Nút lọc dạng icon của toolbar Mode A (data-table-mode-a §2): mỗi nhóm chọn tối đa một giá trị
 * vì BE chỉ nhận một `dataType` / `active`; bấm lại giá trị đang chọn để bỏ lọc nhóm đó.
 */
export function AttributeFilterPopover({
  dataType,
  active,
  onDataTypeChange,
  onActiveChange,
}: Props) {
  const hasFilter = dataType !== null || active !== null;
  return (
    <TooltipProvider>
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={TITLE}
                className={cn(
                  "border-border-default bg-bg-surface text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary rounded-[var(--r-sm)] focus-visible:ring-0",
                  hasFilter && "border-info bg-info/10 text-info hover:bg-info/10 hover:text-info",
                )}
              >
                <Filter className={cn("text-info size-4", hasFilter && "text-current")} />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>{TITLE}</TooltipContent>
        </Tooltip>
        <PopoverContent align="start" className="w-72 p-0">
          <PopoverHeader className="border-border-default border-b p-3">
            <PopoverTitle>{TITLE}</PopoverTitle>
            <PopoverDescription>Chọn loại dữ liệu và trạng thái cần hiển thị.</PopoverDescription>
          </PopoverHeader>
          <Command>
            <CommandList>
              <CommandGroup heading="Loại">
                {ATTRIBUTE_DATA_TYPES.map((type) => (
                  <CommandItem
                    key={type}
                    value={`type-${type}`}
                    onSelect={() => onDataTypeChange(dataType === type ? null : type)}
                    className={ITEM_CLASS}
                  >
                    <Checkbox checked={dataType === type} />
                    <span>{DATA_TYPE_LABEL[type]}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Trạng thái">
                {ATTRIBUTE_ACTIVE_FILTERS.map((value) => (
                  <CommandItem
                    key={value}
                    value={`active-${value}`}
                    onSelect={() => onActiveChange(active === value ? null : value)}
                    className={ITEM_CLASS}
                  >
                    <Checkbox checked={active === value} />
                    <span>{ATTRIBUTE_ACTIVE_LABEL[value]}</span>
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
              disabled={!hasFilter}
              onClick={() => {
                onDataTypeChange(null);
                onActiveChange(null);
              }}
            >
              Xoá lọc
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}
