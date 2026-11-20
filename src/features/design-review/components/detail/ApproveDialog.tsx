"use client";

import { useId, useState } from "react";

import { DESIGN_REASON_MAX, DESIGN_REVIEW_LABELS } from "@/constants";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Duyệt — ghi chú tuỳ chọn (≤ 2000, kiểm lại bằng `designDecisionInputSchema` ở bên gọi). */
export function ApproveDialog({
  open,
  onOpenChange,
  pending,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  error: string | null;
  onConfirm: (notes: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const inputId = useId();
  // Đóng hộp thì bỏ ghi chú đã gõ (điều chỉnh state theo prop, không dùng effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) setNotes("");
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={DESIGN_REVIEW_LABELS.approveTitle}
      description={DESIGN_REVIEW_LABELS.approveDescription}
      confirmLabel={DESIGN_REVIEW_LABELS.approve}
      variant="default"
      loading={pending}
      closeOnConfirm={false}
      error={error}
      onConfirm={() => onConfirm(notes)}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={inputId} className="text-ink-secondary text-xs font-medium">
          {DESIGN_REVIEW_LABELS.approveNotesLabel}
        </Label>
        <Textarea
          id={inputId}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={DESIGN_REASON_MAX}
          rows={3}
          disabled={pending}
          className="border-border-default bg-bg-surface text-ink-primary placeholder:text-ink-tertiary max-h-40 min-h-20 resize-none rounded-[var(--r-sm)]"
        />
        <span className="text-ink-tertiary self-end text-xs tabular-nums">
          {notes.length}/{DESIGN_REASON_MAX}
        </span>
      </div>
      {pending && (
        <p role="status" className="text-ink-secondary text-[0.8125rem]">
          {DESIGN_REVIEW_LABELS.deciding}
        </p>
      )}
    </ConfirmDialog>
  );
}
