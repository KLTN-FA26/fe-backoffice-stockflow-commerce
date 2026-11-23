"use client";

import { cn } from "cn";
import { Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { ReactNode } from "react";

/**
 * Nút `Filter` của `ListToolbar` (truyền qua `tools`) mở popover chứa các ô lọc của trang — cho danh sách mà BE nhận
 * MỘT giá trị mỗi bộ lọc (trạng thái, mốc, ngày…) nên không dùng được popover nhiều lựa chọn của `ListToolbar`.
 * Nút chỉ "active" (viền + nền tông info) khi có bộ lọc khác mặc định (data-table-mode-a §2); mỗi bộ lọc đang bật
 * vẫn phải có chip trong thanh `Cấu hình`. Footer: "Xoá lọc" bên trái.
 */
export function ToolbarFilterPopover({
  label = "Bộ lọc",
  description,
  active,
  onClear,
  children,
  className,
}: {
  label?: string;
  description?: string;
  active: boolean;
  onClear?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={label}
              className={cn(
                "border-border-default bg-bg-surface text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary size-(--control-size) rounded-(--control-radius) shadow-(--control-shadow) focus-visible:ring-0",
                active && "border-info bg-info/10 text-info hover:bg-info/10 hover:text-info",
              )}
            >
              <Filter className={cn("text-dot-info size-3.5", active && "text-current")} />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className={cn("w-[22rem] p-0", className)}>
        <PopoverHeader className="border-border-default border-b p-3">
          <PopoverTitle>{label}</PopoverTitle>
          {description && <PopoverDescription>{description}</PopoverDescription>}
        </PopoverHeader>
        <div className="flex flex-col gap-3 p-3">{children}</div>
        {onClear && (
          <div className="border-border-default flex justify-between gap-2 border-t p-2">
            <Button type="button" variant="outline" size="sm" onClick={onClear} disabled={!active}>
              Xoá lọc
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
