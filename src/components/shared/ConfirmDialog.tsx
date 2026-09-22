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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  onConfirm: (reason?: string) => void;
  variant?: "danger" | "default";
  loading?: boolean;
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
  onConfirm,
  variant = "danger",
  loading = false,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const canConfirm = (!requireReason || reason.trim().length > 0) && !loading;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(requireReason ? reason : undefined);
    setReason("");
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
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

        <div className="space-y-3 px-[18px] py-[18px]">
          <DialogDescription className="text-ink-secondary text-[0.875rem] leading-relaxed">
            {description}
          </DialogDescription>

          {requireReason && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-reason" className="text-ink-secondary text-xs font-medium">
                {reasonLabel} <span className="text-danger">*</span>
              </Label>
              <Input
                id="confirm-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Nhập lý do…"
                autoFocus
                className="border-border-default bg-bg-surface text-ink-primary placeholder:text-ink-tertiary focus:border-accent"
              />
            </div>
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
            type="button"
            size="sm"
            disabled={!canConfirm}
            onClick={handleConfirm}
            className={
              variant === "danger"
                ? "bg-danger hover:bg-danger/90 rounded-[var(--r-sm)] text-white disabled:opacity-50"
                : "bg-brand !text-ink-inverse hover:bg-brand-hover hover:!text-ink-inverse rounded-[var(--r-sm)] disabled:opacity-50"
            }
          >
            {loading ? "Đang xử lý..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
