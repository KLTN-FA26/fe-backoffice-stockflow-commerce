"use client";

import { UI_LABELS } from "@/constants";
import { ColumnFilterButton, HeaderOptionFilter } from "@/components/shared/ColumnHeaderFilter";

import { textIncludes } from "@/lib/text-match";
import { TAXONOMY_STATUS_FILTERS } from "./useTaxonomyListState";

import type { ReactNode } from "react";
import type { TaxonomyListState, TaxonomyStatusFilter } from "./useTaxonomyListState";

const L = UI_LABELS.taxonomy;
const F = L.field;

export const TAXONOMY_STATUS_LABEL: Record<TaxonomyStatusFilter, string> = {
  active: L.active,
  inactive: L.inactive,
};
export const TAXONOMY_STATUS_OPTIONS = TAXONOMY_STATUS_FILTERS.map((value) => ({
  value,
  label: TAXONOMY_STATUS_LABEL[value],
}));

const isStatus = (value: string): value is TaxonomyStatusFilter =>
  TAXONOMY_STATUS_FILTERS.some((s) => s === value);

/** Dòng khớp ô lọc header cột Mã / Tên (bỏ dấu, rỗng = không lọc cột đó). */
export function matchesColumnFilters(
  row: { code: string; name: string },
  filters: { code: string; name: string },
): boolean {
  return textIncludes(row.code, filters.code) && textIncludes(row.name, filters.name);
}

/**
 * Nút lọc trên header bảng thương hiệu / danh mục (khoá theo `key` cột, hai tab dùng chung key
 * `code` / `name` / `active`):
 * - Mã / Tên → khoá URL riêng của tab (`brandCode`, `categoryName`…), không ghi đè ô tìm chính.
 * - Trạng thái → cùng tham số `status` với nút "Bộ lọc" (BE nhận MỘT cờ `active` → chọn một).
 */
export function taxonomyHeaderFilters(
  s: TaxonomyListState,
  noun: string,
): Partial<Record<string, ReactNode>> {
  return {
    code: (
      <ColumnFilterButton
        label={`mã ${noun}`}
        value={s.code}
        placeholder={`Tìm theo mã ${noun}…`}
        onChange={s.setCode}
      />
    ),
    name: (
      <ColumnFilterButton
        label={`tên ${noun}`}
        value={s.name}
        placeholder={`Tìm theo tên ${noun}…`}
        onChange={s.setName}
      />
    ),
    active: (
      <HeaderOptionFilter
        label={F.active.toLowerCase()}
        value={s.status}
        options={TAXONOMY_STATUS_OPTIONS}
        onChange={(value) => s.setStatus(value !== null && isStatus(value) ? value : null)}
        searchPlaceholder="Tìm trạng thái…"
        emptyLabel="Không có trạng thái"
      />
    ),
  };
}
