"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";

import { WINDOW_CHANGE_LABELS as L } from "@/constants";
import { toLocalIsoDate } from "@/lib/format/date";
import { FormDialogBody } from "@/components/shared/FormDialog";

import {
  WINDOW_CHANGE_FIELD_ERRORS,
  WINDOW_CHANGE_STALE_CODES,
  windowChangeErrorView,
} from "../../delivery-window-errors";
import { formatWindowRange, windowOrderViolation } from "../../delivery-window-rules";
import { buildWindowChangeSchema } from "../../delivery-window-schemas";
import { OrderRefusalAlert } from "../OrderRefusalAlert";
import { useOrderActionErrors } from "../useOrderActionErrors";

import { WindowChangeFields } from "./WindowChangeFields";

import type { DeliveryBatch } from "../../delivery-batch-api";
import type { useChangeDeliveryWindow } from "../../delivery-window-mutations";
import type { WindowChangeFormInput, WindowChangeValues } from "../../delivery-window-schemas";

interface WindowChangeFormProps {
  order: { orderId: string; orderNumber: string };
  batch: DeliveryBatch;
  /** Mọi đợt của lịch giao — để kiểm thứ tự các đợt (BR-28). */
  batches: readonly DeliveryBatch[];
  /** Của `DeliveryWindowAction` — dialog cần biết đang gửi để không cho đóng (usePendingSafeDialog). */
  mutation: ReturnType<typeof useChangeDeliveryWindow>;
  onClose: () => void;
}

const DEFAULTS: WindowChangeFormInput = {
  windowStart: "",
  windowEnd: "",
  reasonCode: "",
  note: "",
  evidenceMessageId: "",
};

/**
 * Form dời cửa sổ giao (`POST …/delivery-batches/{batchId}/window-change`, docs 17 BR-28), kiểm bằng zod
 * (`buildWindowChangeSchema`: không ở quá khứ, giữ thứ tự các đợt, ghi chú + lý do + bằng chứng bắt buộc). Mỗi lần mở là
 * một lần thử (Idempotency-Key riêng); lý do BE từ chối hiện ngay trong hộp thoại, dữ liệu đã nhập giữ nguyên.
 */
export function WindowChangeForm({
  order,
  batch,
  batches,
  mutation,
  onClose,
}: WindowChangeFormProps) {
  const { mutate, isPending } = mutation;
  const idPrefix = useId();
  const today = useMemo(() => toLocalIsoDate(new Date().toISOString()), []);
  const schema = useMemo(
    () =>
      buildWindowChangeSchema({
        today,
        orderViolation: (start) => windowOrderViolation(batches, batch.seq, start),
      }),
    [today, batches, batch.seq],
  );
  const form = useForm<WindowChangeFormInput, unknown, WindowChangeValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: DEFAULTS,
  });
  const { refusal, clearRefusal, onError, beginSubmit, idempotencyKeyFor, finishAttempt } =
    useOrderActionErrors(windowChangeErrorView, WINDOW_CHANGE_STALE_CODES, onClose, {
      map: WINDOW_CHANGE_FIELD_ERRORS,
      setError: (field, message) => form.setError(field, { type: "server", message }),
    });
  const windowStart = useWatch({ control: form.control, name: "windowStart" });
  const windowEnd = useWatch({ control: form.control, name: "windowEnd" });

  const submit = form.handleSubmit((values) => {
    if (!beginSubmit()) return;
    clearRefusal();
    // Cùng nội dung bấm lại sau lỗi tạm thời → cùng Idempotency-Key
    const variables = { orderId: order.orderId, batchId: batch.batchId, ...values };
    mutate(
      { ...variables, idempotencyKey: idempotencyKeyFor(variables) },
      {
        onSuccess: () => {
          finishAttempt();
          onClose();
        },
        onError,
      },
    );
  });

  return (
    <FormDialogBody
      title={L.title}
      description={L.description(batch.seq, order.orderNumber)}
      submitLabel={L.submit}
      canSubmit={form.formState.isValid}
      isPending={isPending}
      error={null}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <p className="text-ink-tertiary text-xs">
        {L.previousWindowHint(formatWindowRange(batch.windowStart, batch.windowEnd))}
      </p>
      <WindowChangeFields
        control={form.control}
        register={form.register}
        errors={form.formState.errors}
        today={today}
        windowStart={windowStart}
        windowEnd={windowEnd}
        idPrefix={idPrefix}
      />
      {refusal && <OrderRefusalAlert view={refusal} />}
    </FormDialogBody>
  );
}
