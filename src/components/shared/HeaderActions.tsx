"use client";

import { useSyncExternalStore, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** id của chỗ đặt nút trên thanh breadcrumb (topbar), cạnh chuông thông báo. */
export const HEADER_ACTIONS_ID = "header-actions";

const noop = () => () => {};

/**
 * Đưa nút hành động chính của trang lên thanh breadcrumb (topbar). Topbar dựng sẵn chỗ đặt
 * `#header-actions`; trang chỉ bọc nút trong `<HeaderActions>`. Server / lúc chưa có topbar thì
 * không dựng gì. Không chứa nghiệp vụ.
 */
export function HeaderActions({ children }: { children: ReactNode }) {
  const target = useSyncExternalStore(
    noop,
    () => document.getElementById(HEADER_ACTIONS_ID),
    () => null,
  );
  return target ? createPortal(children, target) : null;
}

/**
 * Nút "Tạo mới" trên thanh breadcrumb — kiểu Vercel "Create New": nút ghost, dấu + và chữ "Tạo mới",
 * không nền đậm. Nút ở chỗ này của mọi trang luôn là tạo mới nên chữ không cần nói tạo gì; `tooltip`
 * (Tooltip shadcn, như sidebar) nói rõ tạo gì hoặc vì sao bị khoá. Nhận mọi prop của `Button` (dùng
 * được với `DialogTrigger asChild`).
 */
export function HeaderCreateButton({
  className,
  children = "Tạo mới",
  tooltip,
  ...props
}: ComponentProps<typeof Button> & { tooltip?: ReactNode }) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("text-ink-primary gap-2 font-medium", className)}
      {...props}
    >
      <Plus className="size-4" aria-hidden />
      {children}
    </Button>
  );
  if (!tooltip) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Nút bị khoá không nhận rê chuột → tooltip gắn lên thẻ bọc để vẫn hiện lý do */}
        {props.disabled ? <span tabIndex={0}>{button}</span> : button}
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
