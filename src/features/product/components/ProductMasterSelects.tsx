"use client";

import { Controller } from "react-hook-form";

import { UI_LABELS } from "@/constants";
import { FormSelect } from "@/components/shared/FormSelect";
import { SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

import { productDraftFormSchema } from "../schemas";
import { taxClassLabel } from "../selectors";
import { ProductSelectTrigger } from "./form-controls";
import { ProductFormField } from "./ProductFormField";

import type { Control } from "react-hook-form";
import type { BrandDto, ProductDraftFormValues } from "../schemas";
import type { Category } from "../types";

/*
 * Ô chọn của form sản phẩm dùng `FormSelect`: trang sửa đổ dữ liệu bằng `form.reset` sau khi tải —
 * Radix Select gọi `onValueChange("")` lúc đó và xoá mất thương hiệu / danh mục đã có.
 */

type SelectFieldProps = { control: Control<ProductDraftFormValues>; error?: string };

/** BE `TaxClass` — nhãn tiếng Việt cùng nguồn với trang chi tiết (`UI_LABELS.product.taxClass`). */
const TAX_CLASSES = productDraftFormSchema.shape.taxClass.options;

const inactiveSuffix = (row: { active?: boolean }) =>
  row.active === false ? UI_LABELS.product.inactiveOption : "";

/**
 * Lookup gồm cả bản ghi đã ngưng (tra tên sản phẩm cũ): chỉ mời chọn cái đang dùng, cộng giá trị hiện
 * tại nếu nó đã ngưng — để ô sửa không rơi về placeholder khi sản phẩm vẫn gắn danh mục / thương hiệu đó.
 */
function selectable<T extends { active?: boolean }>(
  rows: readonly T[],
  idOf: (row: T) => string,
  current: string | undefined,
): T[] {
  return rows.filter((row) => row.active !== false || idOf(row) === current);
}

function selectedCategoryName(categories: readonly Category[], id: string | undefined) {
  const selected = categories.find((c) => c.categoryId === id);
  return selected ? `${selected.name.vi}${inactiveSuffix(selected)}` : undefined;
}

/** Thụt lề theo cấp để cây danh mục đọc được trong một ô chọn phẳng. */
const categoryLabel = (category: Category) =>
  `${"  ".repeat(category.level - 1)}${category.name.vi}${inactiveSuffix(category)}`;

export function BrandSelectField({
  brands,
  control,
  error,
}: SelectFieldProps & { brands: readonly BrandDto[] }) {
  return (
    <ProductFormField htmlFor="brand-id" label="Thương hiệu" error={error} required>
      <Controller
        control={control}
        name="brandId"
        render={({ field }) => (
          <FormSelect value={field.value} onValueChange={field.onChange}>
            <ProductSelectTrigger id="brand-id" aria-invalid={Boolean(error)}>
              <SelectValue placeholder="Chọn thương hiệu" />
            </ProductSelectTrigger>
            <SelectContent>
              {selectable(brands, (b) => b.brandId, field.value).map((brand) => (
                <SelectItem key={brand.brandId} value={brand.brandId}>
                  {brand.name}
                  {inactiveSuffix(brand)}
                </SelectItem>
              ))}
            </SelectContent>
          </FormSelect>
        )}
      />
    </ProductFormField>
  );
}

export function CategorySelectField({
  categories,
  control,
  error,
}: SelectFieldProps & { categories: readonly Category[] }) {
  return (
    <ProductFormField htmlFor="category-id" label="Danh mục" error={error} required>
      <Controller
        control={control}
        name="categoryId"
        render={({ field }) => (
          <FormSelect value={field.value} onValueChange={field.onChange}>
            <ProductSelectTrigger id="category-id" aria-invalid={Boolean(error)}>
              {/* Ô đã đóng chỉ hiện tên — Radix chép nguyên nhãn option (cả khoảng thụt lề) */}
              <SelectValue placeholder="Chọn danh mục">
                {selectedCategoryName(categories, field.value)}
              </SelectValue>
            </ProductSelectTrigger>
            <SelectContent>
              {selectable(categories, (c) => c.categoryId, field.value).map((category) => (
                <SelectItem key={category.categoryId} value={category.categoryId}>
                  {categoryLabel(category)}
                </SelectItem>
              ))}
            </SelectContent>
          </FormSelect>
        )}
      />
    </ProductFormField>
  );
}

export function TaxClassSelectField({ control, error }: SelectFieldProps) {
  return (
    <ProductFormField htmlFor="tax-class" label="Nhóm thuế" error={error} required>
      <Controller
        control={control}
        name="taxClass"
        render={({ field }) => (
          <FormSelect value={field.value} onValueChange={field.onChange}>
            <ProductSelectTrigger id="tax-class">
              <SelectValue />
            </ProductSelectTrigger>
            <SelectContent>
              {TAX_CLASSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {taxClassLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </FormSelect>
        )}
      />
    </ProductFormField>
  );
}
