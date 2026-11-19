"use client";

import { useId, useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Hộp xác nhận kèm ghi chú KHÔNG bắt buộc (BE nhận `note` tuỳ chọn) — `ConfirmDialog` chỉ có ô lý do bắt buộc. Giữ hộp
 * mở tới khi bên gọi đóng lúc thành công; lỗi hiện trong hộp.
 */
export function NoteConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  noteLabel,
  noteMax,
  loading,
  error,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  noteLabel: string;
  noteMax: number;
  loading: boolean;
  error: string | null;
  onConfirm: (note: string) => void;
}) {
  const id = useId();
  const [note, setNote] = useState("");
  // Bên gọi đóng qua `open` → xoá ghi chú (điều chỉnh state theo prop, không useEffect)
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) setNote("");
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      variant="default"
      closeOnConfirm={false}
      loading={loading}
      error={error}
      onConfirm={() => onConfirm(note)}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id} className="text-ink-secondary text-xs font-medium">
          {noteLabel}
        </Label>
        <Textarea
          id={id}
          rows={2}
          maxLength={noteMax}
          className={FORM_TEXTAREA_CLASS}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
    </ConfirmDialog>
  );
}
