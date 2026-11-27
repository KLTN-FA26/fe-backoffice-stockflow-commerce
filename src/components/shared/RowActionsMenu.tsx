"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "cn";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { ColumnDef } from "@/components/shared/DataTable";

/** Một thao tác của dòng: mở trang (`href`) hoặc chạy `onSelect`. */
export interface RowAction {
  label: string;
  /** Icon đứng trước chữ (lucide). Mục nào cũng nên có icon + chữ. */
  icon?: LucideIcon;
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
  /** Dòng phụ dưới nhãn — vd lý do thao tác đang tắt. */
  hint?: string;
  /** Thao tác nguy hiểm (xoá, đóng…) — chữ màu danger, đặt cuối menu. */
  danger?: boolean;
}

const ITEM_CLASS =
  "hover:bg-bg-muted text-ink-primary flex w-full items-start gap-2 rounded-(--r-sm) px-2.5 py-1.5 text-left text-[0.8125rem] focus-visible:bg-bg-muted focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent";

/**
 * Cột "Thao tác" cuối dòng (backoffice-erp-ui A6): MỘT nút "⋯", bấm mở menu các thao tác bằng chữ. Bấm trong menu
 * không mở chi tiết của dòng (`onRowClick`). `label` là tên truy cập của nút, nên kèm tên / mã của dòng. `children`
 * cho nội dung đi kèm thao tác (vd dialog xác nhận) — render ngoài menu.
 */
export function RowActionsMenu({
  label,
  actions,
  children,
}: {
  label: string;
  actions: readonly RowAction[];
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (actions.length === 0) return <>{children}</>;
  return (
    <div className="flex justify-center" onClick={(event) => event.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            className="text-ink-secondary hover:text-ink-primary data-[state=open]:bg-bg-muted"
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="flex w-56 flex-col gap-0.5 p-1">
          {actions.map((action) => {
            const Icon = action.icon;
            const body = (
              <>
                {Icon && (
                  <Icon
                    aria-hidden
                    className={cn(
                      "text-ink-tertiary mt-0.5 size-3.5 shrink-0",
                      action.danger && "text-danger",
                    )}
                  />
                )}
                <span className="flex min-w-0 flex-col">
                  <span className={cn(action.danger && "text-danger")}>{action.label}</span>
                  {action.hint && <span className="text-ink-tertiary text-xs">{action.hint}</span>}
                </span>
              </>
            );
            return action.href && !action.disabled ? (
              <Link
                key={action.label}
                href={action.href}
                className={ITEM_CLASS}
                onClick={() => setOpen(false)}
              >
                {body}
              </Link>
            ) : (
              <button
                key={action.label}
                type="button"
                disabled={action.disabled}
                className={ITEM_CLASS}
                onClick={() => {
                  setOpen(false);
                  action.onSelect?.();
                }}
              >
                {body}
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
      {children}
    </div>
  );
}

/** Cột "Thao tác" chuẩn với menu "⋯" — luôn hiện, không nằm trong "Ẩn hiện cột". */
export function rowActionsColumn<T>(
  getMenu: (row: T) => { label: string; actions: readonly RowAction[] },
  key = "actions",
): ColumnDef<T> {
  return {
    key,
    header: "Thao tác",
    align: "right",
    className: "w-20",
    cell: (row) => <RowActionsMenu {...getMenu(row)} />,
  };
}
