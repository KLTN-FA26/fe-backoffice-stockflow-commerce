"use client";

import { cn } from "cn";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { LayeredDialogContent } from "./LayeredDialogContent";

/**
 * Khung dialog có form — cùng kiểu với `ConfirmDialog` (header viền dưới, body có padding, footer
 * nền `bg.subtle`). Form đặt trong con của `LayeredDialogContent`: Radix unmount khi đóng nên dữ liệu
 * đã nhập tự reset mỗi lần mở lại. Dùng chung cho thao tác PO và biến thể sản phẩm; nằm trên
 * `SlideOverPanel` nên mở được từ trong panel.
 */
export function FormDialog({
  open,
  onOpenChange,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ghi đè cỡ (vd form nhiều khối cần rộng hơn `sm:max-w-[520px]` mặc định). */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <LayeredDialogContent
        className={cn(
          "border-border-default bg-bg-surface gap-0 rounded-[var(--r-xl)] border p-0 shadow-[var(--sh-lg)] ring-0 sm:max-w-[520px]",
          className,
        )}
      >
        {children}
      </LayeredDialogContent>
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
  hideCancel = false,
  readOnly = false,
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
  /** Hộp thoại chỉ báo kết quả (một nút "Đóng"): không cần thêm nút Huỷ. */
  hideCancel?: boolean;
  /** Chỉ xem (thiếu quyền sửa): khoá mọi ô qua `fieldset disabled`, footer chỉ còn nút Đóng. */
  readOnly?: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit && !isPending && !readOnly) onSubmit();
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
        {readOnly ? (
          <fieldset disabled className="m-0 min-w-0 space-y-3 border-0 p-0">
            {children}
          </fieldset>
        ) : (
          children
        )}
        {error && (
          <p role="alert" className="text-danger text-[0.8125rem]">
            {error}
          </p>
        )}
      </div>
      <DialogFooter className="border-border-default bg-bg-subtle mx-0 mb-0 rounded-b-[var(--r-xl)] border-t px-[18px] py-[14px]">
        {!hideCancel && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            // Đang gửi thì không huỷ được (giống ConfirmDialog) — khoá luôn để không trông như bấm được
            disabled={isPending}
            className="border-border-strong bg-bg-surface text-ink-primary hover:bg-bg-muted rounded-[var(--r-sm)]"
          >
            {readOnly ? "Đóng" : "Huỷ"}
          </Button>
        )}
        {!readOnly && (
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
        )}
      </DialogFooter>
    </form>
  );
}
