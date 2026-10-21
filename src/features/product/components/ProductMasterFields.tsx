"use client";

import { CheckboxField } from "@/components/shared/CheckboxField";

import { ProductInput } from "./form-controls";
import { ProductDescriptionFields } from "./ProductDescriptionFields";
import { ProductFormField } from "./ProductFormField";
import { BrandSelectField, CategorySelectField, TaxClassSelectField } from "./ProductMasterSelects";

import type { UseFormReturn } from "react-hook-form";
import type { BrandDto, ProductDraftFormValues } from "../schemas";
import type { Category } from "../types";

interface ProductMasterFieldsProps {
  brands: readonly BrandDto[];
  categories: readonly Category[];
  form: UseFormReturn<ProductDraftFormValues>;
  isEditing: boolean;
}

export function ProductMasterFields({
  brands,
  categories,
  form,
  isEditing,
}: ProductMasterFieldsProps) {
  const {
    control,
    formState: { errors },
    register,
  } = form;

  return (
    <div className="space-y-5">
      <section className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border p-4">
        <h2 className="text-ink-primary text-sm font-semibold">Thông tin định danh</h2>
        <p className="text-ink-secondary mt-1 text-xs">
          Các trường bắt buộc để lưu Product master ở trạng thái Draft.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ProductFormField
            htmlFor="product-code"
            label="Mã sản phẩm"
            error={errors.productCode?.message}
            required
          >
            <ProductInput
              {...register("productCode")}
              id="product-code"
              autoFocus={!isEditing}
              disabled={isEditing}
              aria-invalid={Boolean(errors.productCode)}
              className="font-[family-name:var(--font-mono)] uppercase"
            />
          </ProductFormField>
          <BrandSelectField brands={brands} control={control} error={errors.brandId?.message} />
          <ProductFormField
            htmlFor="name"
            label="Tên sản phẩm"
            error={errors.name?.message}
            required
          >
            <ProductInput {...register("name")} id="name" aria-invalid={Boolean(errors.name)} />
          </ProductFormField>
          <ProductFormField
            htmlFor="name-en"
            label="Tên tiếng Anh"
            error={errors.nameEn?.message}
            required
          >
            <ProductInput
              {...register("nameEn")}
              id="name-en"
              aria-invalid={Boolean(errors.nameEn)}
            />
          </ProductFormField>
          <CategorySelectField
            categories={categories}
            control={control}
            error={errors.categoryId?.message}
          />
          <TaxClassSelectField control={control} error={errors.taxClass?.message} />
        </div>
        <CheckboxField
          control={control}
          name="customizable"
          label="Sản phẩm cho phép cá nhân hoá / in ấn"
          className="mt-4"
        />
      </section>

      <ProductDescriptionFields form={form} />
    </div>
  );
}
