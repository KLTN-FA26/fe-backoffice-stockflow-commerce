"use client";

import { Controller } from "react-hook-form";

import { UI_LABELS } from "@/constants";
import { useWarehouseOptions } from "@/lib/references/warehouse-options";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { fieldClass, useWarehouseLabel } from "../primitives";
import { Field } from "./FormField";

import type { UseFormReturn } from "react-hook-form";
import type { TransferFormInput, TransferFormValues } from "@/features/transfer/types";

const W = UI_LABELS.transfer.warehouseSelect;

/** Chọn kho nguồn / đích — chỉ kho đang hoạt động (BE từ chối kho ngừng: WAREHOUSE_INACTIVE). */
export function WarehouseField({
  form,
  name,
  label,
}: {
  form: UseFormReturn<TransferFormInput, unknown, TransferFormValues>;
  name: "fromWarehouseId" | "toWarehouseId";
  label: string;
}) {
  const options = useWarehouseOptions();
  const warehouses = options.data ?? [];
  const warehouseLabel = useWarehouseLabel();
  const error = form.formState.errors[name]?.message;
  const id = `transfer-${name}`;
  // Sửa nháp có kho đã ngừng hoạt động: vẫn hiện kho đang chọn để người dùng thấy cần đổi kho nào
  const isMissing = (value: string) =>
    options.isSuccess && !!value && !warehouses.some((w) => w.warehouseId === value);
  return (
    <Field id={id} label={label} required error={error}>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Select
            value={field.value}
            // "touched" khi ĐÓNG menu, không phải khi mở (mở menu làm trigger mất focus → báo đỏ sớm)
            onOpenChange={(open) => !open && field.onBlur()}
            onValueChange={(v) => {
              field.onChange(v);
              // BR-01: kiểm lại cặp nguồn / đích — ô bên kia chỉ kiểm khi đã có giá trị hoặc đã bấm lưu,
              // tránh báo đỏ "Chọn kho đích" khi người dùng còn chưa chạm tới
              const other = name === "fromWarehouseId" ? "toWarehouseId" : "fromWarehouseId";
              const checkOther = !!form.getValues(other) || form.formState.isSubmitted;
              void form.trigger(checkOther ? [name, other] : name);
            }}
          >
            <SelectTrigger
              // Lỗi khi lưu → RHF focus đúng ô kho thay vì nhảy xuống dòng hàng
              ref={field.ref}
              id={id}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              className={fieldClass(!!error)}
            >
              <SelectValue placeholder={UI_LABELS.transfer.field.selectWarehouse} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {isMissing(field.value) && (
                  <SelectItem value={field.value}>
                    {warehouseLabel(field.value)} ({W.inactive})
                  </SelectItem>
                )}
                {warehouses.map((w) => (
                  <SelectItem key={w.warehouseId} value={w.warehouseId}>
                    {w.code ? `${w.code} · ${w.name}` : w.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
      />
      {options.isPending && <p className="text-ink-tertiary mt-1 text-xs">{W.loading}</p>}
      {options.isError && (
        <p role="alert" className="text-danger mt-1 text-xs">
          {W.loadFailed}{" "}
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => void options.refetch()}
            className="h-auto p-0 text-xs"
          >
            {UI_LABELS.common.retry}
          </Button>
        </p>
      )}
      {options.isSuccess && warehouses.length === 0 && (
        <p className="text-warning mt-1 text-xs">{W.empty}</p>
      )}
    </Field>
  );
}
