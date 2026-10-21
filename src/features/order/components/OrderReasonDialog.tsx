"use client";

import { useId, useState } from "react";

import { ORDER_ACTION_LABELS } from "@/constants";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import type { z } from "zod";

export interface OrderReasonOption {
  value: string;
  label: string;
}

interface OrderReasonDialogProps<T> {
  title: string;
  description: string;
  submitLabel: string;
  /** Không truyền = dialog chỉ có ghi chú (gỡ giữ). */
  reasonLabel?: string;
  reasons?: readonly OrderReasonOption[];
  noteLabel: string;
  noteMax: number;
  /** Ghi chú luôn bắt buộc (gỡ giữ) — ngược lại chỉ bắt buộc khi chọn "Lý do khác" (schema quyết). */
  noteAlwaysRequired?: boolean;
  /** Schema input — validate `{ reasonCode?, note }` trước khi gửi (BR: OTHER cần ghi chú). */
  schema: z.ZodType<T>;
  isPending: boolean;
  /** Lỗi server đã map tiếng Việt — hiện ngay trong dialog, form giữ nguyên để thử lại. */
  error: string | null;
  onSubmit: (values: T) => void;
  onClose: () => void;
}

type FieldErrors = Partial<Record<"reasonCode" | "note", string>>;

const FIELD =
  "border-border-default bg-bg-surface text-ink-primary placeholder:text-ink-tertiary focus:border-accent rounded-[var(--r-sm)] text-[0.8125rem]";

/**
 * Dialog "lý do + ghi chú" dùng chung cho giữ đơn / gỡ giữ / ghi giao thất bại / đóng phần còn lại.
 * Dialog chỉ đóng do call site khi thành công (lỗi tạm thời giữ nguyên dữ liệu đã nhập).
 */
export function OrderReasonDialog<T>({
  title,
  description,
  submitLabel,
  reasonLabel,
  reasons,
  noteLabel,
  noteMax,
  noteAlwaysRequired = false,
  schema,
  isPending,
  error,
  onSubmit,
  onClose,
}: OrderReasonDialogProps<T>) {
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const reasonId = useId();
  const noteId = useId();
  const noteRequired = noteAlwaysRequired || reasonCode === "OTHER";

  const submit = () => {
    const parsed = schema.safeParse(reasons ? { reasonCode, note } : { note });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] === "reasonCode" ? "reasonCode" : "note";
        next[field] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  };

  return (
    <FormDialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <FormDialogBody
        title={title}
        description={description}
        submitLabel={submitLabel}
        canSubmit
        isPending={isPending}
        error={error}
        onSubmit={submit}
        onCancel={onClose}
      >
        {reasons && (
          <div>
            <Label htmlFor={reasonId} className="text-[0.8125rem]">
              {reasonLabel} <span className="text-danger">*</span>
            </Label>
            <Select
              value={reasonCode}
              onValueChange={(value) => {
                setReasonCode(value);
                setErrors((current) => ({ ...current, reasonCode: undefined, note: undefined }));
              }}
            >
              <SelectTrigger
                id={reasonId}
                autoFocus
                aria-invalid={errors.reasonCode ? true : undefined}
                className={`${FIELD} mt-1 w-full`}
              >
                <SelectValue placeholder={ORDER_ACTION_LABELS.reasonPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.reasonCode && (
              <p role="alert" className="text-danger mt-1 text-xs">
                {errors.reasonCode}
              </p>
            )}
          </div>
        )}
        <div>
          <Label htmlFor={noteId} className="text-[0.8125rem]">
            {noteLabel} {noteRequired && <span className="text-danger">*</span>}
          </Label>
          <Textarea
            id={noteId}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setErrors((current) => ({ ...current, note: undefined }));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            maxLength={noteMax}
            rows={3}
            autoFocus={!reasons}
            aria-invalid={errors.note ? true : undefined}
            className={`${FIELD} mt-1 max-h-40 min-h-20 resize-none`}
          />
          <div className="text-ink-tertiary mt-1 flex items-center justify-between text-xs tabular-nums">
            <span>{reasons ? ORDER_ACTION_LABELS.requiredNoteHint : " "}</span>
            <span>
              {note.length}/{noteMax}
            </span>
          </div>
          {errors.note && (
            <p role="alert" className="text-danger mt-1 text-xs">
              {errors.note}
            </p>
          )}
        </div>
      </FormDialogBody>
    </FormDialog>
  );
}
