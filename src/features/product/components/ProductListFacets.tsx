"use client";

import { ListFilterColumn } from "@/components/shared/ListToolbar";

const ALL = "all";

/**
 * Lọc danh sách sản phẩm theo danh mục / thương hiệu — BE `GET /products?categoryId=&brandId=` (UUID, lọc
 * đúng một giá trị). Giá trị sống trên URL (nuqs, ở `ProductList`); đổi lọc đưa về trang 1. Hai cột của bảng
 * "Bộ lọc" trên toolbar (`ListToolbar.filterPanel`), cùng dáng với cột trạng thái. Mỗi cột chọn một giá trị:
 * tick giá trị đang chọn lần nữa, hoặc tick "Tất cả", là bỏ lọc.
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
      <FacetColumn
        title="Danh mục"
        searchPlaceholder="Tìm danh mục..."
        emptyText="Không có danh mục phù hợp."
        value={categoryId}
        onChange={onCategoryChange}
        options={categories.map((c) => ({ value: c.categoryId, label: c.name.vi }))}
      />
      <FacetColumn
        title="Thương hiệu"
        searchPlaceholder="Tìm thương hiệu..."
        emptyText="Không có thương hiệu phù hợp."
        value={brandId}
        onChange={onBrandChange}
        options={brands.map((b) => ({ value: b.brandId, label: b.name }))}
      />
    </>
  );
}

function FacetColumn({
  value,
  onChange,
  options,
  ...column
}: {
  title: string;
  searchPlaceholder: string;
  emptyText: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: { value: string; label: string }[];
}) {
  const current = value ?? ALL;
  return (
    <ListFilterColumn
      {...column}
      options={[{ value: ALL, label: "Tất cả" }, ...options]}
      isChecked={(option) => option === current}
      onSelect={(option) => onChange(option === ALL || option === current ? null : option)}
    />
  );
}
