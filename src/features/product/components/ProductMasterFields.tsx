"use client";

import { Controller } from "react-hook-form";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ProductDescriptionFields } from "./ProductDescriptionFields";
import { ProductFormField } from "./ProductFormField";
import { ProductLogisticsFields } from "./ProductLogisticsFields";

import type { UseFormReturn } from "react-hook-form";
import type { ProductDraftFormValues } from "../schemas";
import type { Category } from "../types";

interface ProductMasterFieldsProps {
  categories: readonly Category[];
  form: UseFormReturn<ProductDraftFormValues>;
  isEditing: boolean;
  isMock: boolean;
}

export function ProductMasterFields({
  categories,
  form,
  isEditing,
  isMock,
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
            <Input
              {...register("productCode")}
              id="product-code"
              autoFocus={!isEditing}
              disabled={isEditing}
              aria-invalid={Boolean(errors.productCode)}
              className="font-[family-name:var(--font-mono)] uppercase"
            />
          </ProductFormField>
          <ProductFormField
            htmlFor="brand"
            label="Thương hiệu"
            error={errors.brand?.message}
            required
          >
            <Input
              {...register("brand")}
              id="brand"
              autoFocus={isEditing}
              aria-invalid={Boolean(errors.brand)}
            />
          </ProductFormField>
          <ProductFormField
            htmlFor="name"
            label="Tên sản phẩm"
            error={errors.name?.message}
            required
          >
            <Input {...register("name")} id="name" aria-invalid={Boolean(errors.name)} />
          </ProductFormField>
          <ProductFormField
            htmlFor="name-en"
            label="Tên tiếng Anh"
            error={errors.nameEn?.message}
            required
          >
            <Input {...register("nameEn")} id="name-en" aria-invalid={Boolean(errors.nameEn)} />
          </ProductFormField>
          <ProductFormField
            htmlFor="category-id"
            label="Danh mục"
            error={errors.categoryId?.message}
            required
          >
            {isMock ? (
              <Controller
                control={control}
                name="categoryId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="category-id" aria-invalid={Boolean(errors.categoryId)}>
                      <SelectValue placeholder="Chọn danh mục" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.categoryId} value={category.categoryId}>
                          {category.name.vi}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            ) : (
              <Input
                {...register("categoryId")}
                id="category-id"
                aria-invalid={Boolean(errors.categoryId)}
                placeholder="UUID danh mục"
              />
            )}
          </ProductFormField>
          <ProductFormField
            htmlFor="tax-class"
            label="Nhóm thuế"
            error={errors.taxClass?.message}
            required
          >
            <Controller
              control={control}
              name="taxClass"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="tax-class">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STANDARD">Tiêu chuẩn</SelectItem>
                    <SelectItem value="REDUCED">Giảm thuế</SelectItem>
                    <SelectItem value="EXEMPT">Miễn thuế</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </ProductFormField>
        </div>
        <label className="text-ink-secondary mt-4 flex items-center gap-2 text-xs font-medium">
          <input
            {...register("customizable")}
            type="checkbox"
            className="border-border-strong accent-brand size-4 rounded-[var(--r-sm)]"
          />
          Sản phẩm cho phép cá nhân hoá / in ấn
        </label>
      </section>

      <ProductDescriptionFields form={form} />
      <ProductLogisticsFields form={form} />
    </div>
  );
}
