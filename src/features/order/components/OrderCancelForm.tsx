"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";

import {
  ORDER_CANCELLATION_REASON_CODES,
  ORDER_CANCELLATION_REASON_LABELS,
  ORDER_LIMITS,
  UI_LABELS,
} from "@/constants";
import { FormDialogBody } from "@/components/shared/FormDialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { ADMIN_CANCEL_FIELD_ERRORS, adminCancelErrorView } from "../errors";
import { ADMIN_CANCEL_FORM_DEFAULTS, adminCancelFormSchema } from "../form-schemas";
import { useAdminCancelOrder } from "../mutations";
import { cancelConsequence } from "../selectors";

import { FormFieldError, RequiredMark } from "./FormFieldError";
import { OrderRefusalAlert } from "./OrderRefusalAlert";
import { RetainedPercentField } from "./RetainedPercentField";
import { STALE_CODES, useOrderActionErrors } from "./useOrderActionErrors";

import type { AdminCancelFormValues } from "../form-schemas";
import type { AdminCancelOrderInput, Order } from "../types";

export type CancelOrder = Pick<
  Order,
  "orderId" | "orderNumber" | "status" | "paidAmount" | "currency"
>;

const LABEL = "text-ink-secondary text-xs font-medium";

/** Form huỷ đơn admin (mã lý do, ghi chú, % giữ lại) — trong `FormDialog` của OrderCancelAction. */
export function CancelForm({ order, onClose }: { order: CancelOrder; onClose: () => void }) {
  const { mutate: adminCancel, isPending } = useAdminCancelOrder();
  const form = useForm<AdminCancelFormValues, unknown, AdminCancelOrderInput>({
    resolver: zodResolver(adminCancelFormSchema),
    mode: "onChange",
    defaultValues: ADMIN_CANCEL_FORM_DEFAULTS,
  });
  const { refusal, clearRefusal, onError, idempotencyKeyFor, finishAttempt } = useOrderActionErrors(
    adminCancelErrorView,
    STALE_CODES.cancel,
    onClose,
    {
      map: ADMIN_CANCEL_FIELD_ERRORS,
      setError: (field, message) => form.setError(field, { type: "server", message }),
    },
  );
  const [reasonCode, retained] = useWatch({
    control: form.control,
    name: ["reasonCode", "retainedPercent"],
  });
  const { errors } = form.formState;
  const paid = order.paidAmount ?? 0;
  const consequence = cancelConsequence(order.status);
  // Lỗi "OTHER cần ghi chú" chỉ hiện khi đã chọn OTHER (BE Order#cancelByAdmin); lỗi máy chủ
  // trả về cho ô ghi chú (vd quá dài) thì luôn hiện
  const noteError =
    reasonCode === "OTHER" || errors.note?.type === "server" ? errors.note?.message : undefined;

  const submit = form.handleSubmit((input) => {
    clearRefusal();
    // Một lần bấm = một request; cùng nội dung bấm lại sau lỗi tạm thời → cùng Idempotency-Key
    const variables = { id: order.orderId, ...input };
    adminCancel(
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
      title="Huỷ đơn hàng"
      description={`Huỷ đơn ${order.orderNumber}? Hành động này không thể hoàn tác.`}
      submitLabel={UI_LABELS.order.actions.cancel}
      danger
      canSubmit={form.formState.isValid}
      isPending={isPending}
      error={null}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      {consequence && (
        <p className="text-ink-secondary flex gap-1.5 text-xs">
          <AlertTriangle className="text-warning mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {consequence}
        </p>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="cancel-reason-code" className={LABEL}>
          Lý do huỷ <RequiredMark />
        </Label>
        <Controller
          control={form.control}
          name="reasonCode"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value);
                // Ghi chú bắt buộc hay không phụ thuộc mã lý do → kiểm lại ô ghi chú ngay
                void form.trigger("note");
              }}
            >
              <SelectTrigger
                id="cancel-reason-code"
                autoFocus
                aria-required="true"
                aria-invalid={errors.reasonCode ? true : undefined}
                aria-describedby={errors.reasonCode ? "cancel-reason-code-error" : undefined}
                className="w-full"
              >
                <SelectValue placeholder="Chọn lý do huỷ" />
              </SelectTrigger>
              <SelectContent>
                {ORDER_CANCELLATION_REASON_CODES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {ORDER_CANCELLATION_REASON_LABELS[code]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FormFieldError id="cancel-reason-code-error" message={errors.reasonCode?.message} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="cancel-note" className={LABEL}>
          Ghi chú {reasonCode === "OTHER" && <RequiredMark />}
        </Label>
        <Textarea
          id="cancel-note"
          maxLength={ORDER_LIMITS.cancelNoteMax}
          rows={3}
          aria-required={reasonCode === "OTHER" || undefined}
          aria-invalid={noteError ? true : undefined}
          aria-describedby={noteError ? "cancel-note-error" : undefined}
          {...form.register("note")}
        />
        <FormFieldError id="cancel-note-error" message={noteError} />
      </div>
      {/* Chỉ có ý nghĩa khi đã thu tiền: phần giữ lại cho công việc đã làm (docs 17 §4.5) */}
      {paid > 0 && (
        <RetainedPercentField
          registration={form.register("retainedPercent")}
          value={retained}
          paidAmount={paid}
          currency={order.currency}
          error={errors.retainedPercent?.message}
        />
      )}
      {refusal && <OrderRefusalAlert view={refusal} />}
    </FormDialogBody>
  );
}
