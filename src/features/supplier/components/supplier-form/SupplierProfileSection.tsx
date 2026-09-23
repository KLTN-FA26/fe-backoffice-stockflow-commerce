"use client";

import { Building2 } from "lucide-react";

import { Input } from "@/components/ui/input";

import { FieldError, Label, inputCls } from "./fields";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { SupplierCreateInput } from "../../types";

export function SupplierProfileSection({
  register,
  errors,
}: {
  register: UseFormRegister<SupplierCreateInput>;
  errors: FieldErrors<SupplierCreateInput>;
}) {
  return (
    <section className="bg-bg-surface border-border-default rounded-[var(--r-sm)] border p-4">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-sm font-semibold">
        <Building2 size={16} /> Hồ sơ nhà cung cấp
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Mã NCC (BE code)</Label>
          <Input
            {...register("code")}
            placeholder="SUP-001 (để trống = tự sinh)"
            className={inputCls}
          />
          <FieldError message={errors.code?.message} />
        </div>
        <div className="space-y-1">
          <Label required>Tên nhà cung cấp</Label>
          <Input {...register("name")} placeholder="Tên công ty" className={inputCls} />
          <FieldError message={errors.name?.message} />
        </div>
        <div className="space-y-1">
          <Label required>Mã số thuế</Label>
          <Input {...register("taxCode")} placeholder="0123456789" className={inputCls} />
          <FieldError message={errors.taxCode?.message} />
        </div>
      </div>
    </section>
  );
}
