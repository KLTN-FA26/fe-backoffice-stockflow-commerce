"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { RETURN_LABELS, RETURN_REASON_LABELS } from "@/constants/labels-return";
import { RETURN_LIMITS, RETURN_OPENABLE_REASONS } from "@/constants/returns";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FormSelect } from "@/components/shared/FormSelect";
import { FORM_SELECT_CLASS, FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { returnErrorMessage } from "../errors";
import { openInputSchema } from "../input-schemas";
import { useOpenReturnForCustomer } from "../mutations";

import { QuantityLines } from "./QuantityLines";

import type { OpenFormValues } from "../types";

const L = RETURN_LABELS.openDialog;

export interface OpenReturnLine {
  lineId: string;
  sku: string;
  customPrinted: boolean;
  /** Còn trả được: đã giao − phần các yêu cầu khác giữ (selectors `openCaps`). */
  cap: number;
}

interface OpenProps {
  orderId: string;
  orderNumber: string;
  lines: readonly OpenReturnLine[];
  /** Quá hạn 7 ngày / đơn đã hoàn tất: bắt buộc lý do nhận ngoài hạn (BR-RMA-001). */
  late: boolean;
  onClose: () => void;
}

function OpenForm({ orderId, orderNumber, lines, late, onClose }: OpenProps) {
  const [error, setError] = useState<string | null>(null);
  // Một `requestId` cho mỗi lần mở form: bấm lại sau lỗi mạng trả về đúng yêu cầu đã tạo (BE idempotent)
  const [requestId] = useState(() => crypto.randomUUID());
  const open = useOpenReturnForCustomer();
  const form = useForm<OpenFormValues>({
    resolver: zodResolver(openInputSchema),
    defaultValues: {
      reasonCode: "PRINT_DEFECT",
      description: "",
      lateClaimReason: "",
      lines: lines.map((line) => ({
        orderLineId: line.lineId,
        quantity: 0,
        cap: line.cap,
        customPrinted: line.customPrinted,
      })),
    },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit((values) => {
    if (late && !values.lateClaimReason) {
      form.setError("lateClaimReason", { message: L.lateClaim });
      return;
    }
    open.mutate(
      {
        orderId,
        requestId,
        reasonCode: values.reasonCode,
        description: values.description,
        lateClaimReason: values.lateClaimReason,
        lines: values.lines
          .filter((line) => line.quantity > 0)
          .map((line) => ({ orderLineId: line.orderLineId, quantity: line.quantity })),
      },
      { onSuccess: onClose, onError: (failure) => setError(returnErrorMessage(failure)) },
    );
  });

  return (
    <FormDialogBody
      title={`${L.title} — ${orderNumber}`}
      description={L.description}
      submitLabel={L.submit}
      canSubmit
      isPending={open.isPending}
      error={error ?? errors.lines?.message ?? errors.lines?.root?.message ?? null}
      onCancel={onClose}
      onSubmit={() => void submit()}
    >
      <FormField id="open-reason" label={L.reason} required error={errors.reasonCode?.message}>
        <Controller
          control={form.control}
          name="reasonCode"
          render={({ field }) => (
            <FormSelect value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="open-reason" className={FORM_SELECT_CLASS}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RETURN_OPENABLE_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {RETURN_REASON_LABELS[reason]}
                  </SelectItem>
                ))}
              </SelectContent>
            </FormSelect>
          )}
        />
      </FormField>
      <QuantityLines
        idPrefix="open-qty"
        label={L.quantity}
        capLabel={(cap) => `≤ ${cap}`}
        rows={lines.map((line) => ({
          key: line.lineId,
          sku: line.sku,
          hint: line.customPrinted ? RETURN_LABELS.detail.printed : undefined,
          cap: line.cap,
        }))}
        field={(index) => form.register(`lines.${index}.quantity`, { valueAsNumber: true })}
        errorOf={(index) => errors.lines?.[index]?.quantity?.message}
      />
      <FormField
        id="open-description"
        label={L.descriptionField}
        error={errors.description?.message}
      >
        <Textarea
          rows={3}
          maxLength={RETURN_LIMITS.descriptionMax}
          className={FORM_TEXTAREA_CLASS}
          {...fieldA11y("open-description", errors.description?.message)}
          {...form.register("description")}
        />
      </FormField>
      <FormField
        id="open-late"
        label={L.lateClaim}
        required={late}
        error={errors.lateClaimReason?.message}
      >
        <Textarea
          rows={2}
          maxLength={RETURN_LIMITS.lateClaimReasonMax}
          className={FORM_TEXTAREA_CLASS}
          {...fieldA11y("open-late", errors.lateClaimReason?.message)}
          {...form.register("lateClaimReason")}
        />
      </FormField>
    </FormDialogBody>
  );
}

/**
 * Sale mở yêu cầu trả hàng thay khách (docs 17 §4.10 bước 37 — "qua cổng khách hàng / chat"; BE `POST
 * /orders/{id}/returns`, kênh BACK_OFFICE). Yêu cầu do nhân viên mở cần một người khác duyệt (BE bốn mắt).
 */
export function OpenReturnDialog(
  props: Omit<OpenProps, "onClose"> & { open: boolean; onClose: () => void },
) {
  const { open, ...rest } = props;
  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => !next && rest.onClose()}
      className="sm:max-w-xl"
    >
      {open && <OpenForm {...rest} />}
    </FormDialog>
  );
}
