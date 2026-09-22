"use client";

import { Landmark } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { FieldError, Label, inputCls } from "./fields";

import type { Control, FieldErrors, UseFormRegister, UseFormSetValue } from "react-hook-form";
import type { SupplierCreateInput } from "../../types";
import { useWatch } from "react-hook-form";

export function SupplierTermsSection({
  register,
  control,
  setValue,
  errors,
}: {
  register: UseFormRegister<SupplierCreateInput>;
  control: Control<SupplierCreateInput>;
  setValue: UseFormSetValue<SupplierCreateInput>;
  errors: FieldErrors<SupplierCreateInput>;
}) {
  const currency = useWatch({ control, name: "currency" });

  return (
    <section className="bg-bg-surface border-border-default rounded-[var(--r-sm)] border p-4">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-sm font-semibold">
        <Landmark size={16} /> Điều khoản &amp; lead time
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label required>Điều khoản thanh toán</Label>
          <Input {...register("paymentTerms")} placeholder="Net 30" className={inputCls} />
          <FieldError message={errors.paymentTerms?.message} />
        </div>
        <div className="space-y-1">
          <Label required>Lead time (ngày)</Label>
          <Input
            type="number"
            {...register("leadTimeDays", { valueAsNumber: true })}
            min={0}
            className={inputCls}
          />
          <FieldError message={errors.leadTimeDays?.message} />
        </div>
        <div className="space-y-1">
          <Label>Đơn vị tiền tệ</Label>
          <Select
            value={currency}
            onValueChange={(v) => setValue("currency", v as "VND" | "USD" | "CNY")}
          >
            <SelectTrigger aria-label="Tiền tệ" className={inputCls}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Tiền tệ</SelectLabel>
                <SelectItem value="VND">VND — Việt Nam Đồng</SelectItem>
                <SelectItem value="USD">USD — US Dollar</SelectItem>
                <SelectItem value="CNY">CNY — Nhân dân tệ</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  );
}
