"use client";

import { LayeredDialogContent } from "@/components/shared/LayeredDialogContent";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { ReactNode } from "react";

/**
 * Modal của bản đồ kho (chi tiết kệ / khu vực khi xem, thông số khi sửa) — cùng khung với `FormDialog`
 * (header viền dưới, thân cuộn, footer nền `bg.subtle`) nhưng không phải form: thay đổi áp ngay vào
 * bản nháp, nút cuối chỉ là "Đóng" / "Xong". `actions` = nút phụ góc trái footer (xoá, ngừng dùng…).
 */
export function MapDialog({
  open,
  onClose,
  eyebrow,
  title,
  description,
  closeLabel,
  actions,
  children,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  closeLabel: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <LayeredDialogContent
        // Không có mô tả → báo Radix không cần `aria-describedby` thay vì trỏ tới phần tử không có
        {...(description ? {} : { "aria-describedby": undefined })}
        // Chrome chớp khối đen khi lớp `backdrop-filter` mờ dần đè lên SVG / canvas lớn của bản đồ →
        // modal bản đồ chỉ giữ lớp tối, không làm mờ nền
        overlayClassName="supports-backdrop-filter:backdrop-blur-none"
        className="border-border-default bg-bg-surface gap-0 rounded-[var(--r-xl)] border p-0 shadow-[var(--sh-lg)] ring-0 sm:max-w-[560px]"
      >
        <DialogHeader className="border-border-default border-b px-[18px] py-4">
          {eyebrow && <p className="text-ink-tertiary text-[0.6875rem]">{eyebrow}</p>}
          <DialogTitle className="text-ink-primary text-[1.05rem] leading-tight font-semibold">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-dot-warning text-xs font-medium">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="max-h-[65vh] space-y-3 overflow-y-auto px-[18px] py-4">{children}</div>
        <DialogFooter className="border-border-default bg-bg-subtle mx-0 mb-0 flex-row items-center justify-between rounded-b-[var(--r-xl)] border-t px-[18px] py-[14px] sm:justify-between">
          <div className="flex gap-2">{actions}</div>
          <Button type="button" size="sm" onClick={onClose} className="rounded-[var(--r-sm)]">
            {closeLabel}
          </Button>
        </DialogFooter>
      </LayeredDialogContent>
    </Dialog>
  );
}
