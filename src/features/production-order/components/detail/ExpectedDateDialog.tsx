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
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";

import type { ExpectedDateValues, ProductionOrder } from "@/features/production-order/types";

const D = PRODUCTION_LABELS.dialogs;
export type ExpectedDateMode = "accept" | "expected" | "start";

const COPY = {
  accept: { title: D.acceptTitle, description: D.acceptDescription },
  expected: { title: D.expectedTitle, description: D.expectedDescription },
  start: { title: D.startTitle, description: D.startDescription },
} as const;

/**
 * Ghi ngày hoàn thành dự kiến (docs 17 §4.3 bước 8, 10): nhận đơn (bắt buộc), đổi ngày, bắt đầu sản xuất (tuỳ chọn —
 * trống = giữ ngày cũ). Ngày muộn hơn ngày cần hàng → báo trước sẽ có cảnh báo AT_RISK (§4.12), không chặn.
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
    defaultValues: { date: mode === "accept" ? "" : (order.expectedCompletionDate ?? "") },
  });
  const date = useWatch({ control: form.control, name: "date" });
  const fieldError = form.formState.errors.date?.message;

  const submit = form.handleSubmit((values) => {
    setError(null);
    mutation.mutate(
      { id: order.id, version: order.version, expectedCompletionDate: values.date || null },
      { onSuccess: onClose, onError: (failure) => setError(productionOrderErrorMessage(failure)) },
    );
  });

  return (
    <FormDialog open onOpenChange={(next) => !next && onClose()}>
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
      </FormDialogBody>
    </FormDialog>
  );
}
