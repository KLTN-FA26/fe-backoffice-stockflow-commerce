"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { RETURN_LABELS } from "@/constants/labels-return";
import { RETURN_LIMITS } from "@/constants/returns";
import { formatMoney } from "@/lib/format";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { Textarea } from "@/components/ui/textarea";

import { returnErrorMessage } from "../errors";
import { proposeInputSchema } from "../input-schemas";
import { useProposeRefund } from "../mutations";
import { proposedValue, refundableUnits } from "../selectors";

import { MONO } from "./primitives";
import { QuantityLines } from "./QuantityLines";

import type { ProposeFormValues, ReturnRequest } from "../types";

const L = RETURN_LABELS.proposeDialog;

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
    },
  });
  const { errors } = form.formState;
  const watched = useWatch({ control: form.control, name: "lines" });
  const estimate = proposedValue(
    ret.lines,
    new Map(
      watched.map((line) => [line.lineId, Number.isFinite(line.quantity) ? line.quantity : 0]),
    ),
  );
  const submit = form.handleSubmit((values) =>
    propose.mutate(
      {
        id: ret.id,
        version: ret.version,
        lines: values.lines.map((line) => ({ lineId: line.lineId, quantity: line.quantity })),
        note: values.note,
      },
      { onSuccess: onClose, onError: (failure) => setError(returnErrorMessage(failure)) },
    ),
  );

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
        Ước tính trước thuế: <span className={MONO}>{formatMoney(estimate, ret.currency)}</span> (BE
        tính lại theo đơn giá và VAT của dòng đơn)
      </p>
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
 * tối đa số đã duyệt và đã về. Một người khác (Kế toán) duyệt — bốn mắt.
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
