"use client";

import { CUSTOMER_PRICE_UI_LABELS } from "@/constants";

import {
  ColumnFilterButton,
  HeaderNumberRangeFilter,
} from "@/components/shared/ColumnHeaderFilter";

import type { ReactNode } from "react";
import type { PriceTableState } from "./CustomerPriceToolbar";

const L = CUSTOMER_PRICE_UI_LABELS;

/**
 * Lọc trên header MỌI cột dữ liệu của bảng giá một khách (backoffice-erp-ui A5) — trừ Ghi chú và Thao tác: SKU gõ chữ,
 * SL đặt tối thiểu / Số bậc / Giá thấp nhất / Giá cao nhất theo khoảng. Lọc FE trên toàn bộ giá của khách (BE trả cả mảng).
 */
export function priceHeaderFilters(state: PriceTableState): Partial<Record<string, ReactNode>> {
  const f = state.columnFilters;
  const set = state.set;
  return {
    sku: (
      <ColumnFilterButton
        label={L.field.sku.toLowerCase()}
        value={f.sku}
        placeholder={L.toolbar.skuFilter}
        onChange={(value) => set({ cpSku: value })}
      />
    ),
    moq: (
      <HeaderNumberRangeFilter
        label={L.field.moq.toLowerCase()}
        from={f.moqFrom}
        to={f.moqTo}
        onChange={({ from, to }) => set({ cpMoqFrom: from, cpMoqTo: to })}
      />
    ),
    tiers: (
      <HeaderNumberRangeFilter
        label={L.table.tierCount.toLowerCase()}
        from={f.tiersFrom}
        to={f.tiersTo}
        onChange={({ from, to }) => set({ cpTiersFrom: from, cpTiersTo: to })}
      />
    ),
    lowest: (
      <HeaderNumberRangeFilter
        label={L.table.lowest.toLowerCase()}
        unit="₫"
        from={f.lowestFrom}
        to={f.lowestTo}
        onChange={({ from, to }) => set({ cpLowFrom: from, cpLowTo: to })}
      />
    ),
    highest: (
      <HeaderNumberRangeFilter
        label={L.table.highest.toLowerCase()}
        unit="₫"
        from={f.highestFrom}
        to={f.highestTo}
        onChange={({ from, to }) => set({ cpHighFrom: from, cpHighTo: to })}
      />
    ),
  };
}
