"use client";

import { Controller } from "react-hook-form";

import { productionErrorMessage } from "@/features/production-order/errors";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";

import type { UseQueryResult } from "@tanstack/react-query";
import type { Control } from "react-hook-form";
import type { z } from "zod";
import type { qcBaseSchema } from "@/features/production-order/input-schemas";

/**
 * Khu PACKING nhận thành phẩm khi QC hoàn tất LSX đơn (SCRUM-412). Chỉ các khu BE trả ở
 * `GET …/packing-locations` (khu PACKING dùng được của kho lệnh, BE PR #109) — QC không cần quyền xem sơ đồ
 * kho. Một khu = mặc định (để trống, BE tự chọn). BE tự chuyển hàng ngay trong lượt QC; người dùng đã chốt
 * KHÔNG có bước xác nhận bàn giao thủ công.
 */
export function QcPackingField({
  control,
  locations,
}: {
  control: Control<z.input<typeof qcBaseSchema>>;
  locations: UseQueryResult<string[]>;
}) {
  const options = locations.data ?? [];
  let hint: string | undefined;
  if (locations.isPending) hint = "Đang tải khu đóng gói…";
  else if (locations.isError) hint = productionErrorMessage(locations.error);
  else if (options.length === 0)
    hint = "Kho của lệnh chưa có khu đóng gói dùng được — chưa hoàn tất lệnh đơn được.";
  else if (options.length === 1) hint = "Kho chỉ có một khu đóng gói — hàng chuyển vào đó.";

  return (
    <Controller
      control={control}
      name="packingLocation"
      render={({ field, fieldState }) => (
        <FormField
          id="qc-packing"
          label="Khu đóng gói nhận hàng"
          error={fieldState.error?.message}
          hint={hint}
        >
          <select
            {...fieldA11y("qc-packing", fieldState.error?.message, !!hint)}
            value={field.value}
            onChange={(event) => field.onChange(event.target.value)}
            disabled={options.length < 2}
            className={`${FORM_INPUT_CLASS} border px-2`}
          >
            <option value="">
              {options.length === 1 ? `Mặc định: ${options[0]}` : "— Chọn khu đóng gói —"}
            </option>
            {options.length > 1 &&
              options.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
          </select>
        </FormField>
      )}
    />
  );
}
