"use client";

import { Controller } from "react-hook-form";

import { LocationField } from "@/components/backoffice/LocationField";

import type { Control } from "react-hook-form";
import type { z } from "zod";
import type { qcBaseSchema } from "@/features/production-order/input-schemas";

/**
 * Khu PACKING nhận thành phẩm khi QC hoàn tất LSX đơn (SCRUM-412): BE tự chuyển hàng ngay trong lượt QC,
 * không có bước xác nhận bàn giao riêng. Để trống → BE chọn khu đóng gói duy nhất của kho.
 */
export function QcPackingField({
  control,
  warehouseId,
}: {
  control: Control<z.input<typeof qcBaseSchema>>;
  warehouseId: string;
}) {
  return (
    <Controller
      control={control}
      name="packingLocation"
      render={({ field, fieldState }) => (
        <LocationField
          id="qc-packing"
          label="Khu đóng gói nhận hàng"
          warehouseId={warehouseId}
          areaType="PACKING"
          emptyHint="Để trống nếu kho chỉ có một khu đóng gói."
          value={field.value}
          onChange={field.onChange}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}
