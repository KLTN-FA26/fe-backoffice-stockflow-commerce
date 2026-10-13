"use client";

import { Controller } from "react-hook-form";

import { DesignSnapshotField } from "@/components/backoffice/DesignSnapshotField";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Input } from "@/components/ui/input";

import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import type { SampleCreateOutput, SampleCreateValues } from "@/features/sample-request/types";

/** Quy cách một lần mẫu: thiết kế đã xác nhận + phôi + SL (1–1000 cái) + hạn mong muốn. */
export function SampleSpecFields({
  control: c,
  register: r,
  errors,
  customerId,
}: {
  /** Form tạo và form sửa dùng chung kiểu giá trị (form sửa chỉ gửi phần quy cách). */
  control: Control<SampleCreateValues, unknown, SampleCreateOutput>;
  register: UseFormRegister<SampleCreateValues>;
  errors: FieldErrors<SampleCreateValues>;
  customerId: string;
}) {
  return (
    <>
      <Controller
        control={c}
        name="designSnapshotId"
        render={({ field }) => (
          <DesignSnapshotField
            id="sample-design"
            customerId={customerId}
            value={field.value}
            onChange={field.onChange}
            error={errors.designSnapshotId?.message}
          />
        )}
      />
      <FormField id="sample-sku" label="Mã phôi (SKU)" required error={errors.blankSku?.message}>
        <Input
          {...r("blankSku")}
          {...fieldA11y("sample-sku", errors.blankSku?.message)}
          className={`${FORM_INPUT_CLASS} font-[family-name:var(--font-mono)] uppercase`}
        />
      </FormField>
      <FormField
        id="sample-qty"
        label="Số lượng mẫu (cái)"
        required
        error={errors.quantity?.message}
        hint="Từ 1 đến 1000 cái. Phôi được giữ ngay khi gửi sản xuất."
      >
        <Input
          {...r("quantity")}
          {...fieldA11y("sample-qty", errors.quantity?.message, true)}
          inputMode="numeric"
          className={`${FORM_INPUT_CLASS} text-right tabular-nums`}
        />
      </FormField>
      <FormField id="sample-due" label="Cần trước ngày" error={errors.dueDate?.message}>
        <Input
          type="date"
          {...r("dueDate")}
          {...fieldA11y("sample-due", errors.dueDate?.message)}
          className={FORM_INPUT_CLASS}
        />
      </FormField>
    </>
  );
}
