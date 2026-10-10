"use client";

import { Controller } from "react-hook-form";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { FieldError } from "./CreateFormPrimitives";
import { fieldClass } from "./helpers";

import type { CreatePoWizard } from "./useCreateForm";

/**
 * Kho nhận hàng của PO — bắt buộc (SCRUM-390, docs 02 §3), cố định sau khi tạo (BE PR #71).
 * Phiếu nhận hàng của PO chỉ nhận vào đúng kho này.
 */
export function WarehouseField({ w }: { w: CreatePoWizard }) {
  const { control } = w.form;
  const { errors } = w;
  return (
    <div>
      <label htmlFor="po-warehouse" className="text-ink-secondary mb-1 block text-xs font-medium">
        Kho nhận hàng <span className="text-danger">*</span>
      </label>
      <Controller
        control={control}
        name="warehouseId"
        render={({ field }) => (
          <Select
            value={field.value}
            onValueChange={(v) => {
              field.onChange(v);
              field.onBlur();
            }}
            disabled={w.warehousesQuery.isLoading}
          >
            <SelectTrigger
              id="po-warehouse"
              aria-invalid={errors.warehouseId ? true : undefined}
              aria-describedby={errors.warehouseId ? "po-warehouse-error" : undefined}
              className={fieldClass(!!errors.warehouseId)}
            >
              <SelectValue placeholder={w.warehousesQuery.isLoading ? "Đang tải…" : "Chọn kho"} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {w.warehouses.map((wh) => (
                  <SelectItem key={wh.warehouseId} value={wh.warehouseId}>
                    {wh.code ? `${wh.code} — ${wh.name}` : wh.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
      />
      <FieldError id="po-warehouse-error">{errors.warehouseId?.message}</FieldError>
    </div>
  );
}
