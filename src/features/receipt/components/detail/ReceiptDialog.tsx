"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Khung dialog thao tác phiếu nhận (cùng kiểu `ConfirmDialog`). Form nằm trong `DialogContent`:
 * Radix unmount khi đóng nên dữ liệu đã nhập tự reset mỗi lần mở. `Enter` submit, `Esc` đóng.
 */
export function ReceiptDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  isPending,
  error,
  onSubmit,
  onEdit,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  submitLabel: string;
  isPending: boolean;
  /** Lỗi từ server (đã map tiếng Việt) — hiện trong dialog, form giữ nguyên. */
  error: string | null;
  onSubmit: () => void;
  /** Người dùng sửa một ô bất kỳ — màn xoá lỗi server cũ. */
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="border-border-default bg-bg-surface gap-0 rounded-[var(--r-xl)] border p-0 shadow-[var(--sh-lg)] ring-0 sm:max-w-[560px]"
      >
        <form
          noValidate
          onChange={onEdit}
          onSubmit={(event) => {
            event.preventDefault();
            if (!isPending) onSubmit();
          }}
        >
          <DialogHeader className="border-border-default border-b px-[18px] py-4">
            <DialogTitle className="text-ink-primary text-[1.05rem] leading-tight font-semibold">
              {title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 px-[18px] py-[18px]">
            <DialogDescription className="text-ink-secondary text-[0.875rem] leading-relaxed">
              {description}
            </DialogDescription>
            {children}
            {error && (
              <p role="alert" className="text-danger text-[0.8125rem]">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="border-border-default bg-bg-subtle mx-0 mb-0 rounded-b-[var(--r-xl)] border-t px-[18px] py-[14px]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="border-border-strong bg-bg-surface text-ink-primary hover:bg-bg-muted rounded-[var(--r-sm)]"
            >
              Huỷ
            </Button>
            <Button type="submit" size="sm" disabled={isPending} className="rounded-[var(--r-sm)]">
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
