"use client";

import { useState } from "react";

import { ORDER_ACTION_LABELS } from "@/constants";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { NoteField, ReasonSelectField, type OrderReasonOption } from "./ReasonDialogFields";
import {
  useReasonDialogValidation,
  type OrderReasonDialogExtra,
} from "./useReasonDialogValidation";

import type { z } from "zod";

interface OrderReasonDialogProps<T> {
  title: string;
  description: string;
  submitLabel: string;
  /** Không truyền = dialog chỉ có ghi chú (gỡ giữ). */
  reasonLabel?: string;
  reasons?: readonly OrderReasonOption[];
  noteLabel: string;
  notePlaceholder?: string;
  noteMax: number;
  /** Ghi chú luôn bắt buộc (gỡ giữ) — ngược lại chỉ bắt buộc khi chọn "Lý do khác" (schema quyết). */
  noteAlwaysRequired?: boolean;
  /** Schema input — validate `{ reasonCode?, note }` trước khi gửi (BR: OTHER cần ghi chú). */
  schema: z.ZodType<T>;
  /** Ô phụ của thao tác (vd phí đã thoả thuận), gộp vào input trước khi validate. */
  extra?: OrderReasonDialogExtra;
  isPending: boolean;
  /** Lỗi server đã map tiếng Việt — hiện ngay trong dialog, form giữ nguyên để thử lại. */
  error: string | null;
  onSubmit: (values: T) => void;
  onClose: () => void;
}

/**
 * Dialog "lý do + ghi chú" dùng chung cho giữ đơn / gỡ giữ / ghi giao thất bại / đóng phần còn lại / giao một
 * phần. Dialog chỉ đóng do call site khi thành công (lỗi tạm thời giữ nguyên dữ liệu đã nhập).
 */
export function OrderReasonDialog<T>({
  title,
  description,
  submitLabel,
  reasonLabel,
  reasons,
  noteLabel,
  notePlaceholder,
  noteMax,
  noteAlwaysRequired = false,
  schema,
  extra,
  isPending,
  error,
  onSubmit,
  onClose,
}: OrderReasonDialogProps<T>) {
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");
  const { errors, clear, validate } = useReasonDialogValidation(schema, extra);

  const submit = () => {
    const values = validate(reasons ? { reasonCode, note } : { note });
    if (values !== null) onSubmit(values);
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
          <ReasonSelectField
            label={reasonLabel}
            options={reasons}
            value={reasonCode}
            error={errors.reasonCode}
            onChange={(value) => {
              setReasonCode(value);
              clear("reasonCode", "note");
            }}
          />
        )}
        <NoteField
          label={noteLabel}
          placeholder={notePlaceholder}
          value={note}
          max={noteMax}
          required={noteAlwaysRequired || reasonCode === "OTHER"}
          autoFocus={!reasons}
          hint={reasons ? ORDER_ACTION_LABELS.requiredNoteHint : null}
          error={errors.note}
          onChange={(value) => {
            setNote(value);
            clear("note");
          }}
        />
        {extra?.render(errors)}
      </FormDialogBody>
    </FormDialog>
  );
}
