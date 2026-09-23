"use client";

import { Contact } from "lucide-react";

import { Input } from "@/components/ui/input";

import { FieldError, Label, inputCls } from "./fields";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { SupplierCreateInput } from "../../types";

export function SupplierContactSection({
  register,
  errors,
}: {
  register: UseFormRegister<SupplierCreateInput>;
  errors: FieldErrors<SupplierCreateInput>;
}) {
  return (
    <section className="bg-bg-surface border-border-default rounded-[var(--r-sm)] border p-4">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-sm font-semibold">
        <Contact size={16} /> Liên hệ
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label required>Người liên hệ</Label>
          <Input {...register("contactName")} placeholder="Họ tên" className={inputCls} />
          <FieldError message={errors.contactName?.message} />
        </div>
        <div className="space-y-1">
          <Label required>Số điện thoại</Label>
          <Input {...register("contactPhone")} placeholder="0912 345 678" className={inputCls} />
          <FieldError message={errors.contactPhone?.message} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label required>Email</Label>
          <Input
            {...register("contactEmail")}
            type="email"
            placeholder="email@congty.vn"
            className={inputCls}
          />
          <FieldError message={errors.contactEmail?.message} />
        </div>
      </div>
    </section>
  );
}
