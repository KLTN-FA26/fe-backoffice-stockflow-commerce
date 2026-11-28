"use client";

import { Controller } from "react-hook-form";

import { RETURN_RECEIPT_LABELS } from "@/constants/labels-return";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { SegmentedControl } from "@/components/shared/SegmentedControl";

import type { Control } from "react-hook-form";
import type { CreateReceiptFormValues } from "../types";

const L = RETURN_RECEIPT_LABELS.createDialog;

/** Nguồn hàng về: yêu cầu trả hàng đã duyệt, hoặc lô giao hãng hoàn về (cần quyền đọc lô giao). Hai giá trị hiện sẵn (S01-6). */
export function ReceiptSourceTypeField({
  control,
  canReadShipments,
}: {
  control: Control<CreateReceiptFormValues>;
  canReadShipments: boolean;
}) {
  return (
    <Controller
      control={control}
      name="sourceType"
      render={({ field }) => (
        <FormField id="rr-source-type" label={L.sourceType}>
          <SegmentedControl<string>
            {...fieldA11y("rr-source-type")}
            label={L.sourceType}
            value={field.value}
            onChange={field.onChange}
            options={[
              { value: "RMA", label: L.sourceRma },
              ...(canReadShipments ? [{ value: "SHIPMENT", label: L.sourceShipment }] : []),
            ]}
          />
        </FormField>
      )}
    />
  );
}
