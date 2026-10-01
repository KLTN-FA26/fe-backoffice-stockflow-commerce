"use client";

import { Building2 } from "lucide-react";

import { Input } from "@/components/ui/input";

import { FieldError, FieldHint, Label, fieldA11y, fieldId, inputCls } from "./fields";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { SupplierFormValues } from "../../types";

export function SupplierProfileSection({
  register,
  errors,
  isEdit,
}: {
  register: UseFormRegister<SupplierFormValues>;
  errors: FieldErrors<SupplierFormValues>;
  isEdit: boolean;
}) {
  return (
    <section className="bg-bg-surface border-border-default rounded-[var(--r-sm)] border p-4">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-sm font-semibold">
        <Building2 size={16} /> Hồ sơ nhà cung cấp
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={fieldId("code")} required>
            Mã nhà cung cấp
          </Label>
          {/* BE: mã NCC không được đổi sau khi tạo (PR #36) */}
          <Input
            {...register("code")}
            {...fieldA11y("code", errors.code?.message)}
            readOnly={isEdit}
            placeholder="VD: SUP-001"
            className={inputCls}
          />
          <FieldError name="code" message={errors.code?.message} />
          <FieldHint>
            {isEdit
              ? "Mã nhà cung cấp không thể thay đổi sau khi tạo."
              : "Chữ, số, dấu chấm, gạch ngang hoặc gạch dưới; tối đa 64 ký tự."}
          </FieldHint>
        </div>
        <div className="space-y-1">
          <Label htmlFor={fieldId("name")} required>
            Tên nhà cung cấp
          </Label>
          <Input
            {...register("name")}
            {...fieldA11y("name", errors.name?.message)}
            placeholder="Tên công ty"
            className={inputCls}
          />
          <FieldError name="name" message={errors.name?.message} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={fieldId("taxCode")}>Mã số thuế</Label>
          <Input
            {...register("taxCode")}
            {...fieldA11y("taxCode", errors.taxCode?.message)}
            placeholder="VD: 0301234567 hoặc 91440101MA5XXXXX"
            className={inputCls}
          />
          <FieldError name="taxCode" message={errors.taxCode?.message} />
          <FieldHint>Nhận cả mã số thuế nước ngoài: 8–32 ký tự chữ/số.</FieldHint>
        </div>
      </div>
    </section>
  );
}
