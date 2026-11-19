"use client";

import { RETURN_LABELS } from "@/constants/labels-return";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { OpenReturnFields } from "./OpenReturnFields";
import { OpenReturnShipmentField } from "./OpenReturnShipmentField";
import { QuantityLines } from "./QuantityLines";
import { useOpenReturnForm } from "./useOpenReturnForm";

import type { OpenReturnInput } from "./useOpenReturnForm";

const L = RETURN_LABELS.openDialog;

function OpenForm(props: OpenReturnInput) {
  const { form, rows, pending, shipmentId, pickShipment, late, submit, error, isPending } =
    useOpenReturnForm(props);
  const { errors } = form.formState;
  const { shipments } = props;

  return (
    <FormDialogBody
      title={`${L.title} — ${props.orderNumber}`}
      description={L.description(props.windowDays)}
      submitLabel={L.submit}
      canSubmit={!pending && rows.length > 0}
      isPending={isPending}
      error={error ?? errors.lines?.message ?? errors.lines?.root?.message ?? null}
      onCancel={props.onClose}
      onSubmit={() => void submit()}
    >
      {shipments.length > 0 && (
        <OpenReturnShipmentField
          shipments={shipments}
          value={shipmentId}
          onChange={pickShipment}
          error={errors.shipmentId?.message}
        />
      )}
      <OpenReturnFields form={form} late={late} windowDays={props.windowDays}>
        {!pending &&
          (rows.length === 0 ? (
            <p className="text-ink-tertiary text-[0.8125rem]">{L.noLines}</p>
          ) : (
            <QuantityLines
              idPrefix="open-qty"
              label={L.quantity}
              capLabel={(cap) => `≤ ${cap}`}
              rows={rows.map((line) => ({
                key: `${shipmentId}-${line.lineId}`,
                sku: line.sku,
                hint: line.customPrinted ? RETURN_LABELS.detail.printed : undefined,
                cap: line.cap,
              }))}
              field={(index) => form.register(`lines.${index}.quantity`, { valueAsNumber: true })}
              errorOf={(index) => errors.lines?.[index]?.quantity?.message}
            />
          ))}
      </OpenReturnFields>
    </FormDialogBody>
  );
}

/**
 * Sale mở yêu cầu trả hàng thay khách (docs 17 §4.10 bước 37; BE `POST /orders/{id}/returns`, kênh BACK_OFFICE) trên
 * một lô đã giao (WF-05 TH-1). Yêu cầu do nhân viên mở cần một người khác duyệt (BE bốn mắt).
 */
export function OpenReturnDialog(
  props: Omit<OpenReturnInput, "onClose"> & { open: boolean; onClose: () => void },
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
