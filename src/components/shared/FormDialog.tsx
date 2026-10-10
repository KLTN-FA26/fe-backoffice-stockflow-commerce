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
 * Khung dialog có form — cùng kiểu với `ConfirmDialog` (header viền dưới, body có padding, footer
 * nền `bg.subtle`). Form đặt trong con của `DialogContent`: Radix unmount khi đóng nên dữ liệu đã
 * nhập tự reset mỗi lần mở lại. Dùng chung cho thao tác PO và biến thể sản phẩm.
 */
export function FormDialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="border-border-default bg-bg-surface gap-0 rounded-[var(--r-xl)] border p-0 shadow-[var(--sh-lg)] ring-0 sm:max-w-[520px]"
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function FormDialogBody({
  title,
  description,
  submitLabel,
  canSubmit,
  isPending,
  error,
  danger = false,
  onSubmit,
  onCancel,
  children,
}: {
  title: string;
  description: string;
  submitLabel: string;
  canSubmit: boolean;
  isPending: boolean;
  /** Lỗi từ server (đã map tiếng Việt) — hiện ngay trong dialog, form giữ nguyên. */
  error: string | null;
  danger?: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit && !isPending) onSubmit();
      }}
    >
      <DialogHeader className="border-border-default border-b px-[18px] py-4">
        <DialogTitle className="text-ink-primary font-[family-name:var(--font-display)] text-[1.05rem] leading-tight font-semibold">
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
          onClick={onCancel}
          className="border-border-strong bg-bg-surface text-ink-primary hover:bg-bg-muted rounded-[var(--r-sm)]"
        >
          Huỷ
        </Button>
        <Button
          type="submit"
          size="sm"
          variant={danger ? "destructive" : "default"}
          disabled={!canSubmit || isPending}
          className="rounded-[var(--r-sm)] disabled:opacity-50"
        >
          {isPending && <Loader2 className="size-3.5 animate-spin" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
