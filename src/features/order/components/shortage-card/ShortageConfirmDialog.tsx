"use client";

import { useState } from "react";

import { SHORTAGE_LABELS, SHORTAGE_NOTE_MAX } from "@/constants";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { NoteField } from "../ReasonDialogFields";

/**
 * Hộp thoại xác nhận "Thực hiện" của một hướng: liệt kê việc sẽ xảy ra (docs 17 §4.14 bước 58); tuỳ chọn ghi chú (đi vào lịch
 * sử đơn). Không đóng khi đang gửi; lỗi hiện ngay trong hộp thoại, dữ liệu đã nhập giữ nguyên.
 */
export function ShortageConfirmDialog({
  title,
  lines,
  note,
  danger = false,
  isPending,
  error,
  onSubmit,
  onClose,
}: {
  title: string;
  lines: readonly string[];
  /** Có = hiện ô ghi chú, điền sẵn `prefill`. */
  note?: { label: string; prefill: string };
  danger?: boolean;
  isPending: boolean;
  error: string | null;
  onSubmit: (note: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(note?.prefill ?? "");
  return (
    <FormDialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <FormDialogBody
        title={title}
        description={lines[0] ?? ""}
        submitLabel={SHORTAGE_LABELS.confirm.submit}
        canSubmit
        danger={danger}
        isPending={isPending}
        error={error}
        onCancel={onClose}
        onSubmit={() => onSubmit(text.trim())}
      >
        {lines.length > 1 && (
          <ul className="text-ink-secondary list-disc space-y-1 pl-5 text-[0.8125rem]">
            {lines.slice(1).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        {note && (
          <NoteField
            label={note.label}
            placeholder={undefined}
            value={text}
            max={SHORTAGE_NOTE_MAX.execution}
            required={false}
            autoFocus
            hint={null}
            error={undefined}
            onChange={setText}
          />
        )}
      </FormDialogBody>
    </FormDialog>
  );
}
