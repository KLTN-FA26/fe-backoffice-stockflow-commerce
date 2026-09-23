"use client";

import { MapPin } from "lucide-react";

import { Input } from "@/components/ui/input";

import { FieldError, Label, inputCls } from "./fields";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { SupplierCreateInput } from "../../types";

export function SupplierAddressSection({
  register,
  errors,
}: {
  register: UseFormRegister<SupplierCreateInput>;
  errors: FieldErrors<SupplierCreateInput>;
}) {
  return (
    <section className="bg-bg-surface border-border-default rounded-[var(--r-sm)] border p-4">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-sm font-semibold">
        <MapPin size={16} /> Địa chỉ (VN)
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label required>Số nhà / Đường</Label>
          <Input
            {...register("address.street")}
            placeholder="123 Nguyễn Huệ"
            className={inputCls}
          />
          <FieldError message={errors.address?.street?.message} />
        </div>
        <div className="space-y-1">
          <Label required>Phường / Xã</Label>
          <Input {...register("address.ward")} placeholder="Bến Nghé" className={inputCls} />
          <FieldError message={errors.address?.ward?.message} />
        </div>
        <div className="space-y-1">
          <Label required>Quận / Huyện</Label>
          <Input {...register("address.district")} placeholder="Quận 1" className={inputCls} />
          <FieldError message={errors.address?.district?.message} />
        </div>
        <div className="space-y-1">
          <Label required>Tỉnh / TP</Label>
          <Input
            {...register("address.province")}
            placeholder="TP. Hồ Chí Minh"
            className={inputCls}
          />
          <FieldError message={errors.address?.province?.message} />
        </div>
        <div className="space-y-1">
          <Label required>Mã bưu chính</Label>
          <Input {...register("address.postalCode")} placeholder="700000" className={inputCls} />
          <FieldError message={errors.address?.postalCode?.message} />
        </div>
      </div>
    </section>
  );
}
