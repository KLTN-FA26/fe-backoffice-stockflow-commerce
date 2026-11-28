"use client";

import { useState } from "react";

import type { z } from "zod";

import { SHORTAGE_LABELS, SHORTAGE_NOTE_MAX } from "@/constants";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { approveCancellationSchema } from "../../cancellation-request-schemas";
import { CancellationFeeFields } from "../cancellation/CancellationFeeFields";
import { NoteField } from "../ReasonDialogFields";
import { useReasonDialogValidation } from "../useReasonDialogValidation";

import type { CancellationFeeState } from "../cancellation/useCancellationFee";

/** Phí giữ lại + bên chịu phí đã kiểm (cùng schema duyệt huỷ), chỉ có khi hộp thoại có ô phí. */
export type ShortageFeeValues = Pick<
  z.infer<typeof approveCancellationSchema>,
  "retainedPercent" | "agreedFee" | "feeBearer"
>;

/**
 * Hộp thoại xác nhận "Thực hiện" của một hướng: liệt kê việc sẽ xảy ra (docs 17 §4.14 bước 58); tuỳ chọn ghi chú (đi vào lịch
 * sử đơn). Không đóng khi đang gửi; lỗi hiện ngay trong hộp thoại, dữ liệu đã nhập giữ nguyên.
 */
export function ShortageConfirmDialog({
  title,
  lines,
  note,
  fee,
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
  /**
   * Có = hiện ô "phí giữ lại" + bắt buộc chọn "Bên chịu phí" khi có phí (D50); `onSubmit` nhận phí đã kiểm.
   * Chỉ truyền khi `feePossible` (đã có Đơn sản xuất In Production).
   */
  fee?: CancellationFeeState;
  danger?: boolean;
  isPending: boolean;
  error: string | null;
  onSubmit: (note: string, fee: ShortageFeeValues) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(note?.prefill ?? "");
  const extra = fee
    ? {
        values: fee.values,
        canSubmit: fee.canSubmit,
        render: (errors: Readonly<Record<string, string>>) => (
          <CancellationFeeFields fee={fee} errors={errors} />
        ),
      }
    : undefined;
  const { errors, validate } = useReasonDialogValidation(approveCancellationSchema, extra);
  const submit = () => {
    if (!fee) {
      onSubmit(text.trim(), {});
      return;
    }
    const values = validate({ note: text });
    if (values !== null) {
      onSubmit(values.note, {
        retainedPercent: values.retainedPercent,
        agreedFee: values.agreedFee,
        feeBearer: values.feeBearer,
      });
    }
  };
  return (
    <FormDialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <FormDialogBody
        title={title}
        description={lines[0] ?? ""}
        submitLabel={SHORTAGE_LABELS.confirm.submit}
        canSubmit={extra?.canSubmit ?? true}
        danger={danger}
        isPending={isPending}
        error={error}
        onCancel={onClose}
        onSubmit={submit}
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
            error={errors.note}
            onChange={setText}
          />
        )}
        {extra?.render(errors)}
      </FormDialogBody>
    </FormDialog>
  );
}
