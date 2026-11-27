"use client";

import { textIncludes } from "@/lib/text-match";

import {
  ColumnFilterButton,
  HeaderMultiOptionFilter,
  HeaderOptionFilter,
} from "@/components/shared/ColumnHeaderFilter";

import type { ReactNode } from "react";
import type { HeaderFilterOption } from "@/components/shared/ColumnHeaderFilter";

/** Sản phẩm khớp ô lọc cột Mã SP / Tên (rỗng = không lọc cột đó). */
export function matchesColumnSearch(
  product: { name: string },
  code: string,
  filters: { code: string; name: string },
): boolean {
  return textIncludes(code, filters.code) && textIncludes(product.name, filters.name);
}

/**
 * Nút lọc trên header bảng sản phẩm — mỗi nút ghi vào đúng tham số BE `GET /products` mà toolbar đang
 * dùng (URL state), nên header và toolbar luôn khớp nhau:
 * - Mã SP / Tên sản phẩm → khoá URL riêng (`productCode` / `productName`), tách khỏi ô tìm chính. BE
 *   chỉ có một `q` (mã HOẶC tên) nên trang gửi chữ đó để thu hẹp rồi lọc đúng cột bằng
 *   `matchesColumnSearch`.
 * - Danh mục → `categoryId` (chọn một).
 * - Trạng thái → `status` (chọn nhiều, như bộ lọc trạng thái của toolbar).
 */
export function productHeaderFilters({
  code,
  onCodeChange,
  name,
  onNameChange,
  categoryId,
  categoryOptions,
  onCategoryChange,
  statuses,
  statusOptions,
  onToggleStatus,
  onClearStatuses,
}: {
  code: string;
  onCodeChange: (value: string) => void;
  name: string;
  onNameChange: (value: string) => void;
  categoryId: string | null;
  categoryOptions: readonly HeaderFilterOption[];
  onCategoryChange: (value: string | null) => void;
  statuses: readonly string[];
  statusOptions: readonly HeaderFilterOption[];
  onToggleStatus: (value: string) => void;
  onClearStatuses: () => void;
}): Partial<Record<string, ReactNode>> {
  // Danh mục đang lọc trên URL mà danh sách không có (đã ngưng) vẫn phải bỏ lọc được.
  const categories =
    categoryId === null || categoryOptions.some((o) => o.value === categoryId)
      ? categoryOptions
      : [...categoryOptions, { value: categoryId, label: categoryId }];
  return {
    productId: (
      <ColumnFilterButton
        label="mã SP"
        value={code}
        placeholder="Tìm theo mã SP…"
        onChange={onCodeChange}
      />
    ),
    name: (
      <ColumnFilterButton
        label="tên sản phẩm"
        value={name}
        placeholder="Tìm theo tên sản phẩm…"
        onChange={onNameChange}
      />
    ),
    category: (
      <HeaderOptionFilter
        label="danh mục"
        value={categoryId}
        options={categories}
        onChange={onCategoryChange}
        searchPlaceholder="Tìm danh mục…"
        emptyLabel="Không có danh mục"
      />
    ),
    status: (
      <HeaderMultiOptionFilter
        label="trạng thái"
        values={statuses}
        options={statusOptions}
        onToggle={onToggleStatus}
        onClear={onClearStatuses}
        searchPlaceholder="Tìm trạng thái…"
        emptyLabel="Không có trạng thái"
      />
    ),
  };
}
