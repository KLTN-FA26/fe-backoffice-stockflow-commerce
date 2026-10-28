"use client";

import { Controller } from "react-hook-form";

import { UI_LABELS } from "@/constants";
import { FormSelect } from "@/components/shared/FormSelect";
import { TreeSelect } from "@/components/shared/TreeSelect";
import { SelectItem, SelectValue } from "@/components/ui/select";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";

import { productDraftFormSchema } from "../schemas";
import { taxClassLabel } from "../selectors";
import { PRODUCT_SELECT_CLASS, ProductSelectTrigger } from "./form-controls";
import { ProductFormField } from "./ProductFormField";

import type { Control } from "react-hook-form";
import type { BrandDto, ProductDraftFormValues } from "../schemas";
import type { TreeSelectNode } from "@/components/shared/TreeSelect";
import type { Category } from "../types";

/*
 * Ô chọn của form sản phẩm dùng `FormSelect`: trang sửa đổ dữ liệu bằng `form.reset` sau khi tải —
 * Radix Select gọi `onValueChange("")` lúc đó và xoá mất thương hiệu / danh mục đã có.
 */

type SelectFieldProps = { control: Control<ProductDraftFormValues>; error?: string };

/** BE `TaxClass` — nhãn tiếng Việt cùng nguồn với trang chi tiết (`UI_LABELS.product.taxClass`). */
const TAX_CLASSES = productDraftFormSchema.shape.taxClass.options;
const TX = UI_LABELS.taxonomy;

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

/** Nút cây cho `TreeSelect` — tên tiếng Việt, kèm "(ngưng)" nếu danh mục đã ngưng. */
export function categoryTreeNodes(categories: readonly Category[]): TreeSelectNode[] {
  return categories.map((category) => ({
    id: category.categoryId,
    parentId: category.parentId,
    label: `${category.name.vi}${inactiveSuffix(category)}`,
  }));
}

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
            <TitledSelectContent title={"Thương hiệu"}>
              {selectable(brands, (b) => b.brandId, field.value).map((brand) => (
                <SelectItem key={brand.brandId} value={brand.brandId}>
                  {brand.name}
                  {inactiveSuffix(brand)}
                </SelectItem>
              ))}
            </TitledSelectContent>
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
          <TreeSelect
            id="category-id"
            nodes={categoryTreeNodes(selectable(categories, (c) => c.categoryId, field.value))}
            value={field.value ?? ""}
            onChange={field.onChange}
            onBlur={field.onBlur}
            ref={field.ref}
            aria-invalid={Boolean(error)}
            placeholder={TX.categoryPickerPlaceholder}
            searchPlaceholder={TX.categoryPickerSearch}
            emptyText={TX.categoryPickerEmpty}
            className={PRODUCT_SELECT_CLASS}
          />
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
            <TitledSelectContent title={"Nhóm thuế"}>
              {TAX_CLASSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {taxClassLabel(value)}
                </SelectItem>
              ))}
            </TitledSelectContent>
          </FormSelect>
        )}
      />
    </ProductFormField>
  );
}
