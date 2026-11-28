"use client";

import { useMemo } from "react";
import { parseAsString, useQueryState } from "nuqs";

import { UI_LABELS } from "@/constants";
import { statusLabelVi } from "@/lib/status-map";
import { ColumnFilterButton, HeaderOptionFilter } from "@/components/shared/ColumnHeaderFilter";

import { textIncludes } from "@/lib/text-match";
import { isCustomerOwnedSku, variantOptionsLabel } from "../../variant-schemas";
import { uniqueOptions } from "../open-reference-columns";

import type { ReactNode } from "react";
import type { Variant } from "../../variant-schemas";

/** Chữ cột "Tuỳ chọn" của một biến thể — SKU riêng của khách không mang tuỳ chọn trục. */
export function variantOptionText(row: Variant): string {
  return isCustomerOwnedSku(row)
    ? UI_LABELS.product.variants.customerSku
    : variantOptionsLabel(row);
}

/**
 * Lọc theo cột của bảng biến thể (trên URL): Mã SKU, Tên (gõ chữ, bỏ dấu), Tuỳ chọn, Trạng thái (chọn
 * một trong các giá trị đang có). Danh sách biến thể BE trả đủ một lần nên lọc ở FE là đúng trên toàn bộ.
 */
export function useVariantTableFilters(variants: readonly Variant[]): {
  rows: Variant[];
  filters: Partial<Record<string, ReactNode>>;
  filtering: boolean;
} {
  const [sku, setSku] = useQueryState("vSku", parseAsString.withDefault(""));
  const [name, setName] = useQueryState("vName", parseAsString.withDefault(""));
  const [option, setOption] = useQueryState("vOpt", parseAsString);
  const [status, setStatus] = useQueryState("vStatus", parseAsString);

  const rows = useMemo(
    () =>
      variants.filter(
        (row) =>
          textIncludes(row.sku, sku) &&
          textIncludes(row.name, name) &&
          (!option || variantOptionText(row) === option) &&
          (!status || row.status === status),
      ),
    [variants, sku, name, option, status],
  );

  const filters = {
    sku: (
      <ColumnFilterButton
        label="mã SKU"
        value={sku}
        placeholder="Tìm mã SKU…"
        onChange={(v) => void setSku(v || null)}
      />
    ),
    name: (
      <ColumnFilterButton
        label="tên biến thể"
        value={name}
        placeholder="Tìm tên biến thể…"
        onChange={(v) => void setName(v || null)}
      />
    ),
    options: (
      <HeaderOptionFilter
        label="tuỳ chọn"
        value={option}
        options={uniqueOptions(variants.map((r) => [variantOptionText(r), variantOptionText(r)]))}
        onChange={(v) => void setOption(v)}
        searchPlaceholder="Tìm tuỳ chọn…"
        emptyLabel="Không có tuỳ chọn"
      />
    ),
    status: (
      <HeaderOptionFilter
        label="trạng thái"
        value={status}
        options={uniqueOptions(
          variants.map((r) => [r.status, statusLabelVi(r.status, "sku") ?? r.status]),
        )}
        onChange={(v) => void setStatus(v)}
        searchPlaceholder="Tìm trạng thái…"
        emptyLabel="Không có trạng thái"
      />
    ),
  };

  return { rows, filters, filtering: Boolean(sku || name || option || status) };
}
