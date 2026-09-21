"use client";

import { Input } from "@/components/ui/input";

import { ProductFormField } from "./ProductFormField";

import type { UseFormReturn } from "react-hook-form";
import type { ProductDraftFormValues } from "../schemas";

const LOGISTICS_FIELDS = [
  ["weightKg", "Khối lượng (kg)"],
  ["lengthCm", "Dài (cm)"],
  ["widthCm", "Rộng (cm)"],
  ["heightCm", "Cao (cm)"],
] as const;

export function ProductLogisticsFields({ form }: { form: UseFormReturn<ProductDraftFormValues> }) {
  const {
    formState: { errors },
    register,
  } = form;
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border p-4">
      <h2 className="text-ink-primary text-sm font-semibold">Thông số logistics</h2>
      <p className="text-ink-secondary mt-1 text-xs">
        Có thể để trống khi lưu Draft; bắt buộc trước Receipt/Putaway theo BR-03.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {LOGISTICS_FIELDS.map(([name, label]) => (
          <ProductFormField key={name} htmlFor={name} label={label} error={errors[name]?.message}>
            <Input
              {...register(name)}
              id={name}
              inputMode="decimal"
              aria-label={label}
              aria-invalid={Boolean(errors[name])}
            />
          </ProductFormField>
        ))}
      </div>
    </section>
  );
}
