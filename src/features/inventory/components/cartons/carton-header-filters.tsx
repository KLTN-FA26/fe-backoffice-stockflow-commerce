"use client";

import {
  CARTON_FILTER_STATUSES,
  CARTON_LIST_COLUMNS as C,
  CARTON_LIST_LABELS as L,
} from "@/constants";
import { STOCK_STATUSES, stockStatusDisplay } from "@/constants/inventory";
import { statusLabelVi } from "@/lib/status-map";

import { ColumnFilterButton, HeaderOptionFilter } from "@/components/shared/ColumnHeaderFilter";

import { packageStatusDisplay } from "./carton-cells";

import type { ReactNode } from "react";
import type { HeaderFilterOption } from "@/components/shared/ColumnHeaderFilter";
import type { CartonFiltersState } from "./useCartonFilters";

const H = L.column;

const label = (display: string) => statusLabelVi(display, "stock") ?? display;
export const STOCK_STATUS_OPTIONS: HeaderFilterOption[] = STOCK_STATUSES.map((value) => ({
  value,
  label: label(stockStatusDisplay(value)),
}));
export const PACKAGE_STATUS_OPTIONS: HeaderFilterOption[] = CARTON_FILTER_STATUSES.map((value) => ({
  value,
  label: label(packageStatusDisplay(value)),
}));

/** Giá trị đang lọc trên URL mà danh sách không có (link cũ, không còn quyền) vẫn phải có ô để bỏ (§4.1). */
export function withCurrent(
  options: HeaderFilterOption[],
  value: string | null,
): HeaderFilterOption[] {
  if (value === null || options.some((option) => option.value === value)) return options;
  return [...options, { value, label: value }];
}

/**
 * Nút lọc trên header bảng thùng — mọi lọc là tham số BE. SKU / vị trí / lô khớp ĐÚNG mã (BE so bằng nhau), placeholder
 * nói rõ để người dùng không tưởng lọc hỏng khi gõ một phần.
 */
export function cartonHeaderFilters(
  filters: CartonFiltersState,
  warehouses: HeaderFilterOption[],
): Partial<Record<string, ReactNode>> {
  const { state, set } = filters;
  const text = (column: string, value: string, onChange: (next: string) => void) => (
    <ColumnFilterButton
      label={column}
      value={value}
      placeholder={L.exactFilter(column)}
      onChange={onChange}
    />
  );
  const option = (
    column: string,
    values: HeaderFilterOption[],
    value: string | null,
    onChange: (next: string | null) => void,
  ) =>
    values.length > 0 && (
      <HeaderOptionFilter
        label={column}
        value={value}
        options={values}
        onChange={onChange}
        searchPlaceholder={L.optionSearch}
        emptyLabel={L.optionEmpty}
      />
    );
  return {
    [C.PRODUCT]: text(H.product, state.sku, (sku) => set({ sku })),
    [C.WAREHOUSE]: option(
      H.warehouse,
      withCurrent(warehouses, state.warehouse),
      state.warehouse,
      (warehouse) => set({ warehouse }),
    ),
    [C.LOCATION]: text(H.location, state.location, (location) => set({ location })),
    [C.LOT]: text(H.lot, state.lot, (lot) => set({ lot })),
    [C.STATUS]: option(H.status, PACKAGE_STATUS_OPTIONS, state.status, (value) =>
      set({ status: CARTON_FILTER_STATUSES.find((status) => status === value) ?? null }),
    ),
    [C.STOCK_STATUS]: option(H.stockStatus, STOCK_STATUS_OPTIONS, state.stockStatus, (value) =>
      set({ stockStatus: STOCK_STATUSES.find((status) => status === value) ?? null }),
    ),
  };
}
