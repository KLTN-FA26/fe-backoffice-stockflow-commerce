"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { DESIGN_REASON_MAX, DESIGN_REVIEW_LABELS } from "@/constants";

import { designApproveInputSchema } from "@/features/design-review/schemas";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { ApprovePreflight, usePreflightGate } from "./ApprovePreflight";

import type {
  DesignApproveFormOutput,
  DesignApproveFormValues,
} from "@/features/design-review/types";

/**
 * Duyệt — ghi chú tuỳ chọn, ≤ 2000 ký tự sau khi bỏ khoảng trắng (react-hook-form + `designApproveInputSchema`, nhánh
 * "duyệt" của `designDecisionInputSchema`, kltn-docs 12 BR-11). Đóng hộp thì bỏ ghi chú đã gõ.
 */
export function ApproveDialog({
  designId,
  printFileId,
  open,
  onOpenChange,
  pending,
  error,
  onConfirm,
}: {
  designId: string;
  /** File in (`PRINT_READY`) đang chờ duyệt: hộp Duyệt chạy kiểm tra nó khi mở (BO-UX-8). */
  printFileId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  error: string | null;
  onConfirm: (notes: string) => void;
}) {
  const inputId = useId();
  const form = useForm<DesignApproveFormValues, unknown, DesignApproveFormOutput>({
    resolver: zodResolver(designApproveInputSchema),
    defaultValues: { approved: true, notes: "" },
  });
  const notes = useWatch({ control: form.control, name: "notes" }) ?? "";
  const message = form.formState.errors.notes?.message;
  const gate = usePreflightGate(designId, printFileId, open);
  const [acknowledged, setAcknowledged] = useState(false);
  // A new opening asks again: reset the tick while rendering on the open → closed change (react.dev "adjusting state
  // when a prop changes"), not in an effect.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setAcknowledged(false);
  }
  // The parent closes the dialog itself after a decision: whatever closed it, the next opening starts empty.
  useEffect(() => {
    if (!open) form.reset();
  }, [open, form]);

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
      confirmDisabled={gate.blocking && !acknowledged}
      onConfirm={() => void form.handleSubmit((values) => onConfirm(values.notes ?? ""))()}
    >
      <ApprovePreflight
        printFileId={printFileId}
        gate={gate}
        acknowledged={acknowledged}
        onAcknowledge={setAcknowledged}
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={inputId} className="text-ink-secondary text-xs font-medium">
          {DESIGN_REVIEW_LABELS.approveNotesLabel}
        </Label>
        <Textarea
          id={inputId}
          {...form.register("notes")}
          maxLength={DESIGN_REASON_MAX}
          rows={3}
          disabled={pending}
          aria-invalid={message ? true : undefined}
          className="border-border-default bg-bg-surface text-ink-primary placeholder:text-ink-tertiary max-h-40 min-h-20 resize-none rounded-[var(--r-sm)]"
        />
        <span className="text-ink-tertiary self-end text-xs tabular-nums">
          {notes.length}/{DESIGN_REASON_MAX}
        </span>
        {message && (
          <p role="alert" className="text-danger text-xs">
            {message}
          </p>
        )}
      </div>
      {pending && (
        <p role="status" className="text-ink-secondary text-[0.8125rem]">
          {DESIGN_REVIEW_LABELS.deciding}
        </p>
      )}
    </ConfirmDialog>
  );
}
