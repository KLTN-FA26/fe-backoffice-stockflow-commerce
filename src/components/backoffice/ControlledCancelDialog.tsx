"use client";

import { useState } from "react";

import { SHIPPING_LIMITS, UI_LABELS, UNLOAD_REASON_CODES } from "@/constants";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormSelect } from "@/components/shared/FormSelect";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Label } from "@/components/ui/label";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { UnloadReasonCode } from "@/constants";

const C = UI_LABELS.shipping.ftl.controlledCancel;

export interface ControlledCancelValues {
  /** Chưa chọn = `undefined` — bên gọi validate (zod) và báo lỗi. */
  reasonCode: UnloadReasonCode | undefined;
  note: string;
}

interface ControlledCancelDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  loading: boolean;
  error: string | null;
  onSubmit: (values: ControlledCancelValues) => void;
  onClose: () => void;
}

/**
 * Hộp thoại huỷ có kiểm soát sau khi đã bắt đầu xếp hàng (SCRUM-474 UNLOAD-DESIGN điểm 7, docs 09 BR-14): chọn một trong
 * bốn mã lý do (xe hỏng, sai xe, kiện không vừa, khác) và nhập ghi chú. Dùng chung cho huỷ cả kế hoạch và huỷ một xe;
 * không biết nghiệp vụ — bên gọi validate, gọi API và hiện lỗi. Ghi chú đi qua ô lý do của `ConfirmDialog`.
 */
export function ControlledCancelDialog({
  title,
  description,
  confirmLabel,
  loading,
  error,
  onSubmit,
  onClose,
}: ControlledCancelDialogProps) {
  const [reasonCode, setReasonCode] = useState<UnloadReasonCode | undefined>(undefined);
  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => !next && !loading && onClose()}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      variant="danger"
      requireReason
      reasonLabel={C.noteLabel}
      reasonMaxLength={SHIPPING_LIMITS.cancelReasonMax}
      loading={loading}
      closeOnConfirm={false}
      error={error}
      onConfirm={(note) => onSubmit({ reasonCode, note: note ?? "" })}
    >
      <div className="space-y-1.5">
        <Label htmlFor="controlled-cancel-reason-code" className="text-[0.8125rem] font-medium">
          {C.reasonCodeLabel}
        </Label>
        <FormSelect
          value={reasonCode ?? ""}
          onValueChange={(next) => setReasonCode(UNLOAD_REASON_CODES.find((code) => code === next))}
          disabled={loading}
        >
          <SelectTrigger
            id="controlled-cancel-reason-code"
            className="border-border-default bg-bg-surface h-8 w-full rounded-[var(--r-sm)] text-[0.8125rem]"
          >
            <SelectValue placeholder={C.reasonCodePlaceholder} />
          </SelectTrigger>
          <TitledSelectContent title={C.reasonCodeLabel}>
            {UNLOAD_REASON_CODES.map((code) => (
              <SelectItem key={code} value={code}>
                {C.reasonCode[code]}
              </SelectItem>
            ))}
          </TitledSelectContent>
        </FormSelect>
        <p className="text-ink-tertiary text-xs">{C.noteHint}</p>
      </div>
    </ConfirmDialog>
  );
}
