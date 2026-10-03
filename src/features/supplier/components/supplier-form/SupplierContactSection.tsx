"use client";

import { Contact } from "lucide-react";

import { SUPPLIER_FIELD_LABELS } from "@/constants";
import { Input } from "@/components/ui/input";

import { FieldError, FieldHint, Label, fieldA11y, fieldId, inputCls } from "./fields";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { SupplierFormValues } from "../../types";

const L = SUPPLIER_FIELD_LABELS;

export function SupplierContactSection({
  register,
  errors,
}: {
  register: UseFormRegister<SupplierFormValues>;
  errors: FieldErrors<SupplierFormValues>;
}) {
  return (
    <section className="bg-bg-surface border-border-default rounded-[var(--r-sm)] border p-4">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-sm font-semibold">
        <Contact size={16} /> Liên hệ
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={fieldId("contactName")}>{L.contactName}</Label>
          <Input
            {...register("contactName")}
            {...fieldA11y("contactName", errors.contactName?.message)}
            placeholder="Họ tên"
            className={inputCls}
          />
          <FieldError name="contactName" message={errors.contactName?.message} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={fieldId("phone")}>{L.phone}</Label>
          <Input
            {...register("phone")}
            {...fieldA11y("phone", errors.phone?.message)}
            placeholder="0912 345 678 hoặc +86 20 1234 5678"
            className={inputCls}
          />
          <FieldError name="phone" message={errors.phone?.message} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={fieldId("email")}>{L.email}</Label>
          <Input
            {...register("email")}
            {...fieldA11y("email", errors.email?.message)}
            type="email"
            placeholder="email@congty.vn"
            className={inputCls}
          />
          <FieldError name="email" message={errors.email?.message} />
          <FieldHint>Bắt buộc khi gửi PO qua kênh Email (bước Điều khoản).</FieldHint>
        </div>
      </div>
    </section>
  );
}
