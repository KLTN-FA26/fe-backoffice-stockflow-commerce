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
      <h2 className="text-ink-primary text-sm font-semibold">Mô tả và hình ảnh</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ProductFormField htmlFor="description" label="Mô tả tiếng Việt">
          <Textarea {...register("description")} id="description" rows={4} />
        </ProductFormField>
        <ProductFormField htmlFor="description-en" label="Mô tả tiếng Anh">
          <Textarea {...register("descriptionEn")} id="description-en" rows={4} />
        </ProductFormField>
        <div className="lg:col-span-2">
          <ProductFormField
            htmlFor="image-urls"
            label="URL hình ảnh"
            hint="Mỗi dòng một URL, giữ nguyên thứ tự gallery."
          >
            <Textarea {...register("imageUrls")} id="image-urls" rows={3} />
          </ProductFormField>
        </div>
      </div>
    </section>
  );
}
