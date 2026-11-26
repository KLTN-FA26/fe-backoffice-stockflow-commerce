"use client";

import { RETURN_LABELS } from "@/constants/labels-return";
import { formatDate } from "@/lib/format/date";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FormSelect } from "@/components/shared/FormSelect";
import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shared/combobox-select";

import { EMPTY } from "./primitives";

const L = RETURN_LABELS.openDialog;

export interface OpenReturnShipment {
  shipmentId: string;
  deliveredAt: string | null;
  lines: readonly { lineId: string; quantity: number }[];
}

/**
 * Chọn lô đã giao chứa hàng trả (WF-05 TH-1; BE `ReturnRequests.Open.shipmentId`). Chỉ các lô `DELIVERED` — số trả
 * mỗi dòng giới hạn theo số đã giao trên lô. Đơn giao nhiều lô mà không chọn → BE `RETURN_SHIPMENT_REQUIRED`.
 */
export function OpenReturnShipmentField({
  shipments,
  value,
  onChange,
  error,
}: {
  shipments: readonly OpenReturnShipment[];
  value: string;
  onChange: (shipmentId: string) => void;
  error?: string;
}) {
  return (
    <FormField id="open-shipment" label={L.shipment} required error={error} hint={L.shipmentHint}>
      <FormSelect value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className={FORM_SELECT_CLASS} {...fieldA11y("open-shipment", error, true)}>
          <SelectValue placeholder={L.shipmentPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {shipments.map((shipment, index) => (
            <SelectItem key={shipment.shipmentId} value={shipment.shipmentId}>
              {L.shipmentOption(
                index + 1,
                shipment.deliveredAt ? formatDate(shipment.deliveredAt) : EMPTY,
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </FormSelect>
    </FormField>
  );
}
