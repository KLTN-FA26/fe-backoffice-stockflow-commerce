"use client";

import { STANDARD_PRICE_UI_LABELS } from "@/constants";

import { columnSummaryItem, columnToolbarProps } from "@/hooks/use-column-visibility";

import {
  ColumnFilterButton,
  HeaderNumberRangeFilter,
} from "@/components/shared/ColumnHeaderFilter";
import { ListToolbar } from "@/components/shared/ListToolbar";

import { STANDARD_PRICE_COLUMN_KEYS } from "./useStandardPriceFilters";

import type { ReactNode } from "react";
import type { StandardPriceColumn, StandardPriceFilters } from "./useStandardPriceFilters";

const L = STANDARD_PRICE_UI_LABELS;
const B = L.toolbar;

const COLUMN_LABELS: Record<StandardPriceColumn, string> = {
  sku: L.field.sku,
  product: L.field.product,
  variant: L.field.variant,
  tiers: L.field.tiers,
  note: L.field.note,
  actions: "Thao tác",
};

/** Thanh tìm + cấu hình kiểu Vercel (backoffice-erp-ui §2–3): ô tìm, rồi "Ẩn hiện cột" + các viên tóm tắt + "Đặt lại". */
export function StandardPriceToolbar({ filters }: { filters: StandardPriceFilters }) {
  const { columns } = filters;
  return (
    <ListToolbar<never, never, StandardPriceColumn>
      {...columnToolbarProps(columns, COLUMN_LABELS, STANDARD_PRICE_COLUMN_KEYS)}
      controlsIn="summary"
      search={filters.spQ}
      onSearchChange={(value) => filters.set({ spQ: value })}
      searchPlaceholder={L.table.filter}
      // Chỉ hiện ô tìm / tìm trong cột khi đang dùng — không có viên "Chưa dùng" hay "Trường search" (rà UI WF-02 bo-15).
      summaryItems={[
        ...(filters.spQ.trim()
          ? [
              {
                label: B.searchSummary,
                value: `“${filters.spQ}”`,
                active: true,
                onClear: () => filters.set({ spQ: "" }),
              },
            ]
          : []),
        ...(filters.hasColumnFilters
          ? [
              {
                label: B.columnSearch,
                value: [
                  B.columnSummary(filters.spSku, filters.spProduct),
                  filters.spVariant.trim() && `${L.field.variant} “${filters.spVariant.trim()}”`,
                  (filters.spPriceFrom || filters.spPriceTo) &&
                    `${L.field.tiers} ${filters.spPriceFrom || "…"}–${filters.spPriceTo || "…"}`,
                ]
                  .filter(Boolean)
                  .join(", "),
                active: true,
                onClear: () =>
                  filters.set({
                    spSku: "",
                    spProduct: "",
                    spVariant: "",
                    spPriceFrom: "",
                    spPriceTo: "",
                  }),
              },
            ]
          : []),
        columnSummaryItem(columns),
      ]}
      onResetAll={() => {
        filters.clear();
        columns.reset();
      }}
      resetDisabled={!filters.hasFilters && !columns.hasColumnConfig}
    />
  );
}

/**
 * Lọc trên header mọi cột dữ liệu trừ Ghi chú / Thao tác (backoffice-erp-ui §5): SKU, Sản phẩm, Quy cách gõ chữ; Bậc giá
 * theo khoảng đơn giá — cùng state URL với thanh cấu hình.
 */
export function standardPriceHeaderFilters(
  filters: StandardPriceFilters,
): Partial<Record<string, ReactNode>> {
  return {
    sku: (
      <ColumnFilterButton
        label={L.field.sku.toLowerCase()}
        value={filters.spSku}
        placeholder={B.skuFilter}
        onChange={(value) => filters.set({ spSku: value })}
      />
    ),
    product: (
      <ColumnFilterButton
        label={L.field.product.toLowerCase()}
        value={filters.spProduct}
        placeholder={B.productFilter}
        onChange={(value) => filters.set({ spProduct: value })}
      />
    ),
    variant: (
      <ColumnFilterButton
        label={L.field.variant.toLowerCase()}
        value={filters.spVariant}
        placeholder={B.variantFilter}
        onChange={(value) => filters.set({ spVariant: value })}
      />
    ),
    tiers: (
      <HeaderNumberRangeFilter
        label={B.priceFilterLabel}
        unit="₫"
        from={filters.spPriceFrom}
        to={filters.spPriceTo}
        onChange={({ from, to }) => filters.set({ spPriceFrom: from, spPriceTo: to })}
      />
    ),
  };
}
