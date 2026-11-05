"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { PICK_LINE_LABELS, TOAST_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { createIdempotencyAttempt } from "@/lib/api/idempotency";
import { shortPickError } from "@/features/fulfillment/pick-line-errors";
import { useReportShortPick } from "@/features/fulfillment/pick-line-mutations";
import { shortPickInputSchema } from "@/features/fulfillment/pick-line-schemas";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { toast } from "@/components/shared/Toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FieldError } from "../primitives";
import { CodeField } from "./CodeField";

import type { CodeOption } from "@/features/fulfillment/pick-line-selectors";
import type { PickLine, ShortPickFormValues, ShortPickValues } from "@/features/fulfillment/types";

const L = PICK_LINE_LABELS;

export interface ShortPickProps {
  taskId: string;
  line: PickLine;
  locationOptions: readonly CodeOption[];
  /** Báo thiếu xong — màn bỏ câu "Đã lấy dòng …" của lần xác nhận trước. */
  onReported?: () => void;
}

/**
 * Báo thiếu một dòng (X-SHORT bước 01, BE `POST …/pick-lines/{lineId}/short`): người được gán đứng ở bin,
 * chọn vị trí + nhập số thực có (0..phân bổ−1, kiểm trên form). BE chuyển dòng sang SHORT, tạm giữ đơn
 * (INVENTORY), không trừ tồn; người lấy làm tiếp dòng khác. Idempotency như xác nhận dòng.
 */
export function ShortPickDialog({
  taskId,
  line,
  locationOptions,
  onReported,
  onClose,
}: ShortPickProps & { onClose: () => void }) {
  const report = useReportShortPick();
  const [attempt] = useState(() => createIdempotencyAttempt());
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ShortPickFormValues, unknown, ShortPickValues>({
    resolver: zodResolver(shortPickInputSchema(line.allocatedQty)),
    defaultValues: { locationCode: "", foundQuantity: "" },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) => {
    if (report.isPending) return;
    setServerError(null);
    const idempotencyKey = attempt.keyFor({ lineId: line.lineId, ...values });
    report.mutate(
      { taskId, lineId: line.lineId, values, idempotencyKey },
      {
        onSuccess: (updated) => {
          attempt.reset();
          toast.success(TOAST_MESSAGES.fulfillment.shortReported(updated.sku, updated.shortQty));
          onReported?.();
          onClose();
        },
        onError: (error) => {
          if (error instanceof ApiError) attempt.settle(error);
          else attempt.reset();
          const result = shortPickError(error, line);
          if (result.field) {
            form.setError(result.field, { type: "server", message: result.message });
          } else if (result.stale) {
            toast.error(result.message);
            onClose();
          } else {
            setServerError(result.message);
          }
        },
      },
    );
  });

  const found = form.register("foundQuantity");
  return (
    <FormDialog open onOpenChange={(open) => !open && onClose()}>
      <FormDialogBody
        title={L.shortTitle}
        description={L.target(line.locationCode, line.allocatedQty, line.sku)}
        submitLabel={L.shortAction}
        canSubmit
        isPending={report.isPending}
        error={serverError}
        onSubmit={() => void submit()}
        onCancel={onClose}
      >
        <Controller
          control={form.control}
          name="locationCode"
          render={({ field }) => (
            <CodeField
              id="short-location"
              label={L.location}
              placeholder={L.locationPlaceholder}
              options={locationOptions}
              value={field.value}
              error={errors.locationCode?.message}
              autoFocus
              onChange={(value) => {
                field.onChange(value);
                form.clearErrors("locationCode");
                // Chọn xong vị trí → sang ô số tìm thấy, như thẻ xác nhận dòng (không cần chuột)
                document.getElementById("short-found")?.focus();
              }}
            />
          )}
        />
        <div className="space-y-1">
          <Label htmlFor="short-found" className="text-ink-primary text-[0.8125rem] font-medium">
            {L.foundQuantity}
          </Label>
          <Input
            id="short-found"
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={errors.foundQuantity ? true : undefined}
            aria-describedby={errors.foundQuantity ? "short-found-error" : "short-found-hint"}
            className="bg-bg-surface h-9 rounded-[var(--r-sm)] text-right tabular-nums"
            {...found}
          />
          {errors.foundQuantity ? (
            <FieldError id="short-found-error">{errors.foundQuantity.message}</FieldError>
          ) : (
            <p id="short-found-hint" className="text-ink-tertiary text-xs">
              {L.foundHint(line.allocatedQty)}
            </p>
          )}
        </div>
      </FormDialogBody>
    </FormDialog>
  );
}
