"use client";

import { Textarea } from "@/components/ui/textarea";

import { ProductFormField } from "./ProductFormField";

import type { UseFormReturn } from "react-hook-form";
import type { ProductDraftFormValues } from "../schemas";

export function ProductDescriptionFields({
  form,
}: {
  form: UseFormReturn<ProductDraftFormValues>;
}) {
  const { register } = form;
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border p-4">
      <h2 className="text-ink-primary text-sm font-semibold">Mô tả</h2>
      <p className="text-ink-secondary mt-1 text-xs">
        Hình ảnh quản lý theo từng biến thể; kích thước, khối lượng theo từng SKU.
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <ProductFormField htmlFor="short-description" label="Mô tả ngắn">
            <Textarea {...register("shortDescription")} id="short-description" rows={2} />
          </ProductFormField>
        </div>
        <ProductFormField htmlFor="description" label="Mô tả tiếng Việt">
          <Textarea {...register("description")} id="description" rows={4} />
        </ProductFormField>
        <ProductFormField htmlFor="description-en" label="Mô tả tiếng Anh">
          <Textarea {...register("descriptionEn")} id="description-en" rows={4} />
        </ProductFormField>
      </div>
    </section>
  );
}
