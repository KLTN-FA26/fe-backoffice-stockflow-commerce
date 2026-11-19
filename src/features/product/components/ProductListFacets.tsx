"use client";

import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "all";

/**
 * Lọc danh sách sản phẩm theo danh mục / thương hiệu — BE `GET /products?categoryId=&brandId=` (UUID, lọc
 * đúng một giá trị). Giá trị sống trên URL (nuqs, ở `ProductList`); đổi lọc đưa về trang 1.
 */
export function ProductListFacets({
  categories,
  brands,
  categoryId,
  brandId,
  onCategoryChange,
  onBrandChange,
}: {
  categories: readonly { categoryId: string; name: { vi: string } }[];
  brands: readonly { brandId: string; name: string }[];
  categoryId: string | null;
  brandId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  onBrandChange: (brandId: string | null) => void;
}) {
  return (
    <>
      <FacetSelect
        id="product-category"
        label="Danh mục"
        value={categoryId}
        onChange={onCategoryChange}
        options={categories.map((c) => ({ value: c.categoryId, label: c.name.vi }))}
      />
      <FacetSelect
        id="product-brand"
        label="Thương hiệu"
        value={brandId}
        onChange={onBrandChange}
        options={brands.map((b) => ({ value: b.brandId, label: b.name }))}
      />
    </>
  );
}

function FacetSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="text-ink-secondary text-[0.8125rem]">
        {label}
      </Label>
      <Select value={value ?? ALL} onValueChange={(next) => onChange(next === ALL ? null : next)}>
        <SelectTrigger id={id} className={`${FORM_SELECT_CLASS} w-[13rem]`}>
          <SelectValue />
        </SelectTrigger>
        <TitledSelectContent title={label}>
          <SelectItem value={ALL}>Tất cả</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </TitledSelectContent>
      </Select>
    </div>
  );
}
