"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { PRODUCTION_LABELS } from "@/constants";
import { todayIso } from "@/lib/date-range";
import { formatDate } from "@/lib/format/date";

import { productionOrderErrorMessage } from "@/features/production-order/errors";
import { expectedDateInput } from "@/features/production-order/input-schemas";
import {
  useAcceptProductionOrder,
  useChangeExpectedCompletion,
  useStartProduction,
} from "@/features/production-order/mutations";

import { Alert } from "@/components/shared/Alert";
import { DatePicker } from "@/components/shared/DatePicker";
import { FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { fieldA11y, FormField } from "@/components/shared/FormField";
import { Textarea } from "@/components/ui/textarea";

import type { ExpectedDateValues, ProductionOrder } from "@/features/production-order/types";

const D = PRODUCTION_LABELS.dialogs;
export type ExpectedDateMode = "accept" | "expected" | "start";

const COPY = {
  accept: { title: D.acceptTitle, description: D.acceptDescription },
  expected: { title: D.expectedTitle, description: D.expectedDescription },
  start: { title: D.startTitle, description: D.startDescription },
} as const;

/** Ngày đã ghi đã qua thì không điền sẵn — ngày quá khứ làm form hỏng mà chưa hiện lỗi (nút Xác nhận tắt không rõ lý do). */
const prefill = (date: string | null | undefined) => (date && date >= todayIso() ? date : "");

/**
 * Ghi ngày hoàn thành dự kiến (docs 17 §4.3 bước 8, 10): nhận đơn (bắt buộc), đổi ngày, bắt đầu sản xuất (tuỳ chọn —
 * trống = giữ ngày cũ). Ngày muộn hơn ngày cần hàng → báo trước sẽ có cảnh báo AT_RISK (§4.12), không chặn.
 * Nhận đơn kèm ghi chú tuỳ chọn (bước 8, chốt lại 2026-11-20) — chỉ ở chế độ này, BE ghi một lần.
 */
export function ExpectedDateDialog({
  mode,
  order,
  onClose,
}: {
  mode: ExpectedDateMode;
  order: ProductionOrder;
  onClose: () => void;
}) {
  const accept = useAcceptProductionOrder();
  const change = useChangeExpectedCompletion();
  const start = useStartProduction();
  const mutation = mode === "accept" ? accept : mode === "expected" ? change : start;
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ExpectedDateValues>({
    resolver: zodResolver(expectedDateInput(mode === "start")),
    mode: "onChange",
    defaultValues: {
      date: mode === "accept" ? "" : prefill(order.expectedCompletionDate),
      note: "",
    },
  });
  const date = useWatch({ control: form.control, name: "date" });
  const fieldError = form.formState.errors.date?.message;
  const noteError = form.formState.errors.note?.message;

  const submit = form.handleSubmit((values) => {
    setError(null);
    const input = {
      id: order.id,
      version: order.version,
      expectedCompletionDate: values.date || null,
    };
    const handlers = {
      onSuccess: onClose,
      onError: (failure: unknown) => setError(productionOrderErrorMessage(failure)),
    };
    if (mode === "accept") accept.mutate({ ...input, note: values.note }, handlers);
    else mutation.mutate(input, handlers);
  });

  return (
    <FormDialog open onOpenChange={(next) => !next && !mutation.isPending && onClose()}>
      <FormDialogBody
        title={COPY[mode].title}
        description={COPY[mode].description}
        submitLabel={D.confirm}
        canSubmit={form.formState.isValid}
        isPending={mutation.isPending}
        error={error}
        onSubmit={() => void submit()}
        onCancel={onClose}
      >
        <FormField
          id="expected-date"
          label={D.expectedDate}
          required={mode !== "start"}
          error={fieldError}
        >
          <Controller
            control={form.control}
            name="date"
            render={({ field }) => (
              <DatePicker
                id="expected-date"
                value={field.value}
                onChange={field.onChange}
                min={todayIso()}
                clearable={mode === "start"}
                autoFocus
                aria-invalid={fieldError ? true : undefined}
              />
            )}
          />
        </FormField>
        {date && date > order.needByDate && (
          <Alert tone="warning">{D.later(formatDate(order.needByDate))}</Alert>
        )}
        {mode === "accept" && (
          <FormField
            id="accept-note"
            label={D.acceptNote}
            hint={D.acceptNoteHint}
            error={noteError}
          >
            <Textarea
              {...fieldA11y("accept-note", noteError, true)}
              rows={2}
              placeholder={D.acceptNotePlaceholder}
              className={FORM_TEXTAREA_CLASS}
              {...form.register("note")}
            />
          </FormField>
        )}
      </FormDialogBody>
    </FormDialog>
  );
}
