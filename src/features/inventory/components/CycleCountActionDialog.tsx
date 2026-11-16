"use client";

import {
  CYCLE_COUNT_ACTION,
  CYCLE_COUNT_LABELS,
  CYCLE_COUNT_LIMITS,
} from "@/constants/cycle-count";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Textarea } from "@/components/ui/textarea";

export type CycleCountActionKind = (typeof CYCLE_COUNT_ACTION)[keyof typeof CYCLE_COUNT_ACTION];
type Action = CycleCountActionKind;

const L = CYCLE_COUNT_LABELS;
/** Tiêu đề + mô tả của từng hành động — tiêu đề cũng là nhãn nút mở hộp xác nhận. */
export const CYCLE_COUNT_ACTION_COPY: Record<Action, { title: string; description: string }> = {
  [CYCLE_COUNT_ACTION.SUBMIT]: { title: L.submit, description: L.submitDescription },
  [CYCLE_COUNT_ACTION.CANCEL]: { title: L.cancel, description: L.cancelDescription },
  [CYCLE_COUNT_ACTION.RECOUNT]: { title: L.recount, description: L.recountDescription },
};

interface CycleCountActionDialogProps {
  action: Action;
  pending: boolean;
  /** Lỗi của lần xác nhận vừa rồi — hiện TRONG dialog (dialog modal ẩn phần còn lại khỏi trình đọc màn hình). */
  error: React.ReactNode;
  note: string;
  onNote: (note: string) => void;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
}

/**
 * Hộp xác nhận nộp / huỷ / đếm lại. Huỷ bắt buộc lý do (docs 20 §4.2 e); đếm lại có ghi chú tuỳ chọn cho phiếu
 * mới (§4.2 d11). Dialog giữ nguyên khi lỗi để người dùng không phải gõ lại.
 */
export function CycleCountActionDialog({
  action,
  pending,
  error,
  note,
  onNote,
  onClose,
  onConfirm,
}: CycleCountActionDialogProps) {
  const cancelling = action === CYCLE_COUNT_ACTION.CANCEL;
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={CYCLE_COUNT_ACTION_COPY[action].title}
      description={CYCLE_COUNT_ACTION_COPY[action].description}
      confirmLabel={CYCLE_COUNT_ACTION_COPY[action].title}
      cancelLabel={L.back}
      requireReason={cancelling}
      reasonLabel={L.cancelReason}
      reasonMaxLength={CYCLE_COUNT_LIMITS.reasonLength}
      loading={pending}
      closeOnConfirm={false}
      error={error}
      variant={cancelling ? "danger" : "default"}
      onConfirm={onConfirm}
    >
      {action === CYCLE_COUNT_ACTION.RECOUNT && (
        <div className="space-y-1.5">
          <label htmlFor="cycle-count-recount-note" className="text-sm font-medium">
            {L.recountNote}
          </label>
          <Textarea
            id="cycle-count-recount-note"
            value={note}
            maxLength={CYCLE_COUNT_LIMITS.noteLength}
            onChange={(event) => onNote(event.target.value)}
          />
        </div>
      )}
    </ConfirmDialog>
  );
}
