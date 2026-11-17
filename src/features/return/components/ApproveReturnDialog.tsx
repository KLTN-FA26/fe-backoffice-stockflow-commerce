"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { RETURN_LABELS } from "@/constants/labels-return";
import { RETURN_LIMITS } from "@/constants/returns";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { Textarea } from "@/components/ui/textarea";

import { returnErrorMessage } from "../errors";
import { approveInputSchema } from "../input-schemas";
import { useApproveReturn } from "../mutations";

import { QuantityLines } from "./QuantityLines";

import type { ApproveFormValues, ReturnRequest } from "../types";

const L = RETURN_LABELS.approveDialog;

function ApproveForm({ ret, onClose }: { ret: ReturnRequest; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const approve = useApproveReturn();
  const form = useForm<ApproveFormValues>({
    resolver: zodResolver(approveInputSchema),
    defaultValues: {
      lines: ret.lines.map((line) => ({
        lineId: line.id,
        quantity: line.requestedQuantity,
        cap: line.requestedQuantity,
      })),
      note: "",
    },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit((values) =>
    approve.mutate(
      {
        id: ret.id,
        version: ret.version,
        lines: values.lines.map((line) => ({
          lineId: line.lineId,
          approvedQuantity: line.quantity,
        })),
        note: values.note,
      },
      { onSuccess: onClose, onError: (failure) => setError(returnErrorMessage(failure)) },
    ),
  );
  const linesError = (errors.lines as { root?: { message?: string } } | undefined)?.root?.message;

  return (
    <FormDialogBody
      title={`${L.title} ${ret.rmaNumber}`}
      description={L.description}
      submitLabel={L.submit}
      canSubmit
      isPending={approve.isPending}
      error={error ?? linesError ?? errors.lines?.message ?? null}
      onCancel={onClose}
      onSubmit={() => void submit()}
    >
      <QuantityLines
        idPrefix="approve-qty"
        label={L.quantity}
        capLabel={(cap) => `/ ${cap}`}
        rows={ret.lines.map((line) => ({
          key: line.id,
          sku: line.sku,
          cap: line.requestedQuantity,
        }))}
        field={(index) => form.register(`lines.${index}.quantity`, { valueAsNumber: true })}
        errorOf={(index) => errors.lines?.[index]?.quantity?.message}
      />
      <FormField id="approve-note" label={L.note} error={errors.note?.message}>
        <Textarea
          rows={2}
          maxLength={RETURN_LIMITS.noteMax}
          className={FORM_TEXTAREA_CLASS}
          {...fieldA11y("approve-note", errors.note?.message)}
          {...form.register("note")}
        />
      </FormField>
    </FormDialogBody>
  );
}

/** Sale duyệt (toàn bộ hoặc bớt từng dòng): hàng phải về kho xuất trong 14 ngày (docs 17 §4.10 bước 38, BR-18). */
export function ApproveReturnDialog({
  ret,
  onClose,
}: {
  ret: ReturnRequest | null;
  onClose: () => void;
}) {
  return (
    <FormDialog open={ret !== null} onOpenChange={(open) => !open && onClose()}>
      {ret && <ApproveForm ret={ret} onClose={onClose} />}
    </FormDialog>
  );
}
