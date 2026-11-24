"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { RETURN_LABELS, RETURN_REFUSAL_REASON_LABELS } from "@/constants/labels-return";
import { RETURN_LIMITS, RETURN_REFUSAL_REASONS } from "@/constants/returns";
import { formatMoney } from "@/lib/format";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { Textarea } from "@/components/ui/textarea";

import { returnErrorMessage } from "../errors";
import { proposeInputSchema, refusesRefund, withholdsUnits } from "../input-schemas";
import { useProposeRefund } from "../mutations";
import { proposedValue, refundableUnits } from "../selectors";

import { PickField } from "./PickField";
import { MONO } from "./primitives";
import { QuantityLines } from "./QuantityLines";

import type { ProposeFormValues, ReturnRequest } from "../types";

const L = RETURN_LABELS.proposeDialog;
const REFUSAL_OPTIONS = RETURN_REFUSAL_REASONS.map((reason) => ({
  value: reason,
  label: RETURN_REFUSAL_REASON_LABELS[reason],
}));

const quantityOf = (value: number) => (Number.isFinite(value) ? value : 0);

function ProposeForm({ ret, onClose }: { ret: ReturnRequest; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const propose = useProposeRefund();
  const form = useForm<ProposeFormValues>({
    resolver: zodResolver(proposeInputSchema),
    defaultValues: {
      lines: ret.lines.map((line) => ({
        lineId: line.id,
        quantity: refundableUnits(line),
        cap: refundableUnits(line),
      })),
      note: "",
      refusalReason: "",
      refusalNote: "",
    },
  });
  const { errors } = form.formState;
  const watched = useWatch({ control: form.control, name: "lines" });
  const estimate = proposedValue(
    ret.lines,
    new Map(watched.map((line) => [line.lineId, quantityOf(line.quantity)])),
  );
  // WF-05 Q-4: giữ lại đơn vị đã về → có thể nêu lý do (khách đọc); mọi dòng 0 → bắt buộc
  const current = watched.map((line) => ({ quantity: quantityOf(line.quantity), cap: line.cap }));
  const withholding = withholdsUnits(current);
  const refusing = refusesRefund(current);
  const reasonValue = useWatch({ control: form.control, name: "refusalReason" });
  const submit = form.handleSubmit((values) => {
    // Hoàn đủ thì BE từ chối lý do — một lý do chọn trước đó rồi sửa lại số không được gửi
    const reason =
      withholdsUnits(values.lines) && values.refusalReason !== ""
        ? values.refusalReason
        : undefined;
    propose.mutate(
      {
        id: ret.id,
        version: ret.version,
        lines: values.lines.map((line) => ({ lineId: line.lineId, quantity: line.quantity })),
        note: values.note,
        refusalReason: reason,
        refusalNote: reason ? values.refusalNote : undefined,
      },
      { onSuccess: onClose, onError: (failure) => setError(returnErrorMessage(failure)) },
    );
  });

  return (
    <FormDialogBody
      title={`${L.title} ${ret.rmaNumber}`}
      description={L.description}
      submitLabel={L.submit}
      canSubmit
      isPending={propose.isPending}
      error={error ?? errors.lines?.message ?? errors.lines?.root?.message ?? null}
      onCancel={onClose}
      onSubmit={() => void submit()}
    >
      <QuantityLines
        idPrefix="propose-qty"
        label={L.quantity}
        capLabel={L.max}
        rows={ret.lines.map((line) => ({
          key: line.id,
          sku: line.sku,
          cap: refundableUnits(line),
        }))}
        field={(index) => form.register(`lines.${index}.quantity`, { valueAsNumber: true })}
        errorOf={(index) => errors.lines?.[index]?.quantity?.message}
      />
      <p className="text-ink-secondary text-[0.8125rem]">
        {L.estimate} <span className={MONO}>{formatMoney(estimate, ret.currency)}</span>{" "}
        {L.estimateNote}
      </p>
      {withholding && (
        <>
          <p className="text-ink-secondary text-[0.8125rem]">
            {refusing ? L.refusalHint : L.withholdHint}
          </p>
          <Controller
            control={form.control}
            name="refusalReason"
            render={({ field }) => (
              <PickField
                id="propose-refusal-reason"
                label={L.refusalReason}
                placeholder={L.refusalReasonPlaceholder}
                required={refusing}
                error={errors.refusalReason?.message}
                value={field.value}
                onChange={field.onChange}
                options={REFUSAL_OPTIONS}
              />
            )}
          />
          <FormField
            id="propose-refusal-note"
            label={reasonValue === "OTHER" ? L.refusalNoteRequired : L.refusalNote}
            required={reasonValue === "OTHER"}
            error={errors.refusalNote?.message}
          >
            <Textarea
              rows={2}
              maxLength={RETURN_LIMITS.refusalNoteMax}
              className={FORM_TEXTAREA_CLASS}
              {...fieldA11y("propose-refusal-note", errors.refusalNote?.message)}
              {...form.register("refusalNote")}
            />
          </FormField>
        </>
      )}
      <FormField id="propose-note" label={L.note} error={errors.note?.message}>
        <Textarea
          rows={2}
          maxLength={RETURN_LIMITS.noteMax}
          className={FORM_TEXTAREA_CLASS}
          {...fieldA11y("propose-note", errors.note?.message)}
          {...form.register("note")}
        />
      </FormField>
    </FormDialogBody>
  );
}

/**
 * Sale đề xuất hoàn tiền cho yêu cầu đã về kho (docs 17 §4.10 bước 40; BE `POST /returns/{id}/resolution`): mỗi dòng
 * tối đa số đã duyệt và đã về. WF-05 Q-4: để 0 mọi dòng là đề xuất không hoàn tiền với lý do cố định (khách đọc được) và
 * ghi chú công khai tuỳ chọn. Một người khác (Kế toán) duyệt — bốn mắt, bằng nút "Duyệt hoàn tiền" sẵn có.
 */
export function ProposeRefundDialog({
  ret,
  onClose,
}: {
  ret: ReturnRequest | null;
  onClose: () => void;
}) {
  return (
    <FormDialog open={ret !== null} onOpenChange={(open) => !open && onClose()}>
      {ret && <ProposeForm ret={ret} onClose={onClose} />}
    </FormDialog>
  );
}
