"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { ConfirmReasonField } from "./ConfirmReasonField";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Nếu true, hiện ô nhập lý do bắt buộc trước khi cho confirm. */
  requireReason?: boolean;
  reasonLabel?: string;
  /** Giới hạn độ dài lý do (vd theo độ rộng cột DB). Không truyền = không giới hạn. */
  reasonMaxLength?: number;
  onConfirm: (reason?: string) => void;
  variant?: "danger" | "default";
  loading?: boolean;
  /**
   * Mặc định `true`: bấm xác nhận là đóng + xoá lý do ngay. `false` cho thao tác gọi API:
   * dialog giữ nguyên (kèm lý do đã nhập) tới khi bên gọi tự đóng lúc thành công — lỗi
   * thì người dùng sửa/thử lại, không phải gõ lại lý do.
   */
  closeOnConfirm?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Quay lại",
  requireReason = false,
  reasonLabel = "Lý do",
  reasonMaxLength,
  onConfirm,
  variant = "danger",
  loading = false,
  closeOnConfirm = true,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");
  // Bên gọi đóng dialog qua prop `open` (không qua onOpenChange) → xoá lý do khi đóng.
  // Điều chỉnh state trong render thay vì useEffect (react.dev "adjusting state on prop change").
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) setReason("");
  }
  const canConfirm = (!requireReason || reason.trim().length > 0) && !loading;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(requireReason ? reason : undefined);
    if (!closeOnConfirm) return;
    setReason("");
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        // Đang xử lý → không cho đóng bằng ESC/overlay, tránh dialog biến mất khi thao tác còn chạy
        if (!v && loading) return;
        if (!v) setReason("");
        onOpenChange(v);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="border-border-default bg-bg-surface gap-0 rounded-[var(--r-xl)] border p-0 shadow-[var(--sh-lg)] ring-0 sm:max-w-[440px]"
      >
        <DialogHeader className="border-border-default border-b px-[18px] py-4">
          <DialogTitle className="text-ink-primary font-[family-name:var(--font-display)] text-[1.05rem] leading-tight font-semibold">
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* form: Ctrl/⌘ + Enter trong ô lý do = xác nhận (Mode A — thao tác không cần chuột).
            `contents` để form không thêm hộp layout, giữ nguyên grid của DialogContent. */}
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();
            handleConfirm();
          }}
        >
          <div className="space-y-3 px-[18px] py-[18px]">
            <DialogDescription className="text-ink-secondary text-[0.875rem] leading-relaxed">
              {description}
            </DialogDescription>

            {requireReason && (
              <ConfirmReasonField
                label={reasonLabel}
                value={reason}
                onChange={setReason}
                maxLength={reasonMaxLength}
              />
            )}
          </div>

          <DialogFooter className="border-border-default bg-bg-subtle mx-0 mb-0 rounded-b-[var(--r-xl)] border-t px-[18px] py-[14px]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => {
                setReason("");
                onOpenChange(false);
              }}
              className="border-border-strong bg-bg-surface text-ink-primary hover:bg-bg-muted rounded-[var(--r-sm)]"
            >
              {cancelLabel}
            </Button>
            <Button
              variant="ghost"
              type="submit"
              size="sm"
              disabled={!canConfirm}
              className={
                variant === "danger"
                  ? "bg-danger hover:bg-danger/90 rounded-[var(--r-sm)] text-white disabled:opacity-50"
                  : "bg-brand !text-ink-inverse hover:bg-brand-hover hover:!text-ink-inverse rounded-[var(--r-sm)] disabled:opacity-50"
              }
            >
              {loading ? "Đang xử lý..." : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
