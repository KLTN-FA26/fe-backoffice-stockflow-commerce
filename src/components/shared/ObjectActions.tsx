"use client";

import { createContext, useContext, useState } from "react";
import Link from "next/link";
import { cn } from "cn";
import { LoaderCircle, MoreHorizontal } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";

import { Button } from "@/components/ui/button";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Hàng thao tác của header đối tượng (backoffice-erp-ui B10), kiểu "Gỡ xuất bản [⋯]": MỘT nút chính nền đậm có icon đúng
 * nội dung, mọi việc khác trong menu "⋯" — việc huỷ / xoá chữ đỏ, việc thường (sửa, xuất…) chữ thường. Không chứa nghiệp vụ.
 *
 * Thao tác nào cũng có thể tự giữ dialog của nó (đặt cạnh nút trong cùng component). Menu vì vậy luôn được dựng (chỉ ẩn khi
 * đóng — `forceMount`), nên bấm một mục rồi menu đóng thì dialog của mục đó vẫn còn. `ActionTrigger` tự đổi dáng theo chỗ
 * đặt (nút chính hay mục menu) qua context, nên component thao tác chỉ cần dùng `ActionTrigger` thay cho `Button`.
 */

type Slot = { kind: "primary" } | { kind: "menu"; close: () => void };
const SlotContext = createContext<Slot>({ kind: "primary" });

export function ObjectActions({
  primary,
  menuLabel,
  hasMenu,
  children,
}: {
  /** Nút chính (thường là một `ActionTrigger`, hoặc component thao tác dùng nó). */
  primary?: ReactNode;
  /** Tên truy cập của nút "⋯", vd "Thao tác khác với đơn hàng". */
  menuLabel: string;
  /** Có mục nào trong menu — không có thì không hiện nút "⋯". */
  hasMenu: boolean;
  /** Các mục của menu "⋯". */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex shrink-0 items-center gap-2">
      {primary && (
        <SlotContext.Provider value={{ kind: "primary" }}>{primary}</SlotContext.Provider>
      )}
      {hasMenu && (
        <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
          <PopoverPrimitive.Trigger asChild>
            <Button type="button" variant="outline" size="icon-sm" aria-label={menuLabel}>
              <MoreHorizontal className="size-4" aria-hidden />
            </Button>
          </PopoverPrimitive.Trigger>
          <PopoverPrimitive.Portal forceMount>
            <PopoverPrimitive.Content
              forceMount
              align="end"
              sideOffset={4}
              aria-label={menuLabel}
              // Đóng thì ẩn hẳn (thuộc tính `hidden`, không chỉ CSS) — không ai thấy / chạm được mục ẩn, kể cả screen reader
              hidden={!open}
              className="bg-popover text-popover-foreground ring-foreground/10 z-50 flex w-60 flex-col gap-0.5 rounded-lg p-1 text-sm shadow-md ring-1 outline-hidden"
            >
              <SlotContext.Provider value={{ kind: "menu", close: () => setOpen(false) }}>
                {children}
              </SlotContext.Provider>
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
      )}
    </div>
  );
}

const MENU_ITEM =
  "text-ink-primary hover:bg-bg-muted w-full justify-start gap-2 font-normal focus-visible:bg-bg-muted";
const MENU_DANGER = "text-danger hover:bg-danger/10 hover:text-danger";

/**
 * Một thao tác: ngoài menu là nút chính nền đậm, trong menu "⋯" là mục chữ (đỏ khi `danger`). `href` → link; còn lại
 * `onClick` (bấm trong menu thì đóng menu trước).
 */
export function ActionTrigger({
  icon: Icon,
  label,
  onClick,
  href,
  disabled,
  danger = false,
  loading = false,
  title,
}: {
  icon: LucideIcon;
  label: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  /** Việc phá huỷ (huỷ, xoá, từ chối, đóng…). */
  danger?: boolean;
  loading?: boolean;
  title?: string;
}) {
  const slot = useContext(SlotContext);
  const inMenu = slot.kind === "menu";
  const icon = loading ? (
    <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
  ) : (
    <Icon className={cn("size-3.5", inMenu && !danger && "text-ink-tertiary")} aria-hidden />
  );
  const className = inMenu ? cn(MENU_ITEM, danger && MENU_DANGER) : "gap-1.5";
  const variant = inMenu ? ("ghost" as const) : ("default" as const);
  if (href && !disabled)
    return (
      <Button asChild size="sm" variant={variant} className={className} title={title}>
        <Link href={href} onClick={() => inMenu && slot.close()}>
          {icon}
          {label}
        </Link>
      </Button>
    );
  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      className={className}
      disabled={disabled || loading}
      title={title}
      onClick={() => {
        if (inMenu) slot.close();
        onClick?.();
      }}
    >
      {icon}
      {label}
    </Button>
  );
}
