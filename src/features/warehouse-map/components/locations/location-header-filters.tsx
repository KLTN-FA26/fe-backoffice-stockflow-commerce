"use client";

import {
  LOCATION_KINDS,
  LOCATION_STATUSES,
  LOCATION_STOCK_FILTERS,
  WAREHOUSE_LOCATION_COLUMNS as C,
  WAREHOUSE_LOCATION_LABELS as L,
} from "@/constants";
import { statusLabelVi } from "@/lib/status-map";

import { ColumnFilterButton, HeaderOptionFilter } from "@/components/shared/ColumnHeaderFilter";

import type { ReactNode } from "react";
import type { HeaderFilterOption } from "@/components/shared/ColumnHeaderFilter";
import type { locationFilterOptions } from "@/features/warehouse-map/location-list-filters";
import type { LocationFiltersState } from "./useLocationFilters";

const H = L.column;

export interface LocationFilterOptions {
  zones: HeaderFilterOption[];
  shelves: HeaderFilterOption[];
  statuses: HeaderFilterOption[];
}

/**
 * Giá trị đang lọc trên URL mà danh sách không có (link cũ, vị trí đã gỡ) vẫn phải có trong ô lọc — nếu không màn bị
 * lọc ngầm mà không có chỗ bỏ (data-table-mode-a §4.1).
 */
function withCurrent(options: HeaderFilterOption[], value: string | null): HeaderFilterOption[] {
  if (value === null || options.some((option) => option.value === value)) return options;
  return [...options, { value, label: value }];
}

/** Lựa chọn có nhãn tiếng Việt cho các bộ lọc trên header, kèm giá trị đang lọc trên URL. */
export function labelFilterOptions(
  raw: ReturnType<typeof locationFilterOptions>,
  filters: LocationFiltersState["filters"],
): LocationFilterOptions {
  return {
    zones: withCurrent(
      raw.zones.map((zone) => ({ value: zone.value, label: zone.label ?? L.noZone })),
      filters.zone,
    ),
    shelves: withCurrent(
      raw.shelves.map((code) => ({ value: code, label: code })),
      filters.shelf,
    ),
    statuses: withCurrent(
      raw.statuses.map((status) => ({
        value: status,
        label: statusLabelVi(status, "location") ?? status,
      })),
      filters.status,
    ),
  };
}

const KIND_OPTIONS = LOCATION_KINDS.map((kind) => ({ value: kind, label: L.kind[kind] }));
const STOCK_OPTIONS = LOCATION_STOCK_FILTERS.map((value) => ({
  value,
  label: L.stockFilter[value],
}));

const isKind = (value: string | null) => LOCATION_KINDS.find((kind) => kind === value) ?? null;
const isStock = (value: string | null) =>
  LOCATION_STOCK_FILTERS.find((stock) => stock === value) ?? null;

/**
 * Nút lọc trên header bảng vị trí. Lọc theo hàng (SKU, có hàng / trống) chỉ có khi đọc được tồn — `stockFilter`
 * false khi tồn bị cắt (kho nhiều dòng hơn trần đọc): "Trống" khi đó có thể sai.
 */
export function locationHeaderFilters(
  state: LocationFiltersState,
  options: LocationFilterOptions,
  stock: { sku: boolean; stockFilter: boolean },
): Partial<Record<string, ReactNode>> {
  const { filters, set } = state;
  const option = (
    label: string,
    values: HeaderFilterOption[],
    value: string | null,
    onChange: (next: string | null) => void,
  ) =>
    values.length > 0 && (
      <HeaderOptionFilter
        label={label}
        value={value}
        options={values}
        onChange={onChange}
        searchPlaceholder={L.optionSearch}
        emptyLabel={L.optionEmpty}
      />
    );
  return {
    [C.CODE]: (
      <ColumnFilterButton
        label={H.code}
        value={filters.code}
        placeholder={L.columnSearch(H.code)}
        onChange={(code) => set({ code })}
      />
    ),
    [C.KIND]: option(H.kind, KIND_OPTIONS, filters.kind, (kind) => set({ kind: isKind(kind) })),
    [C.ZONE]: option(H.zone, options.zones, filters.zone, (zone) => set({ zone })),
    [C.SHELF]: option(H.shelf, options.shelves, filters.shelf, (shelf) => set({ shelf })),
    [C.STATUS]: option(H.status, options.statuses, filters.status, (status) =>
      set({ status: LOCATION_STATUSES.find((value) => value === status) ?? null }),
    ),
    ...(stock.sku && {
      [C.SKUS]: (
        <ColumnFilterButton
          label={H.skus}
          value={filters.sku}
          placeholder={L.columnSearch(H.skus)}
          onChange={(sku) => set({ sku })}
        />
      ),
    }),
    ...(stock.stockFilter && {
      [C.ON_HAND]: option(H.onHand, STOCK_OPTIONS, filters.stock, (value) =>
        set({ stock: isStock(value) }),
      ),
    }),
  };
}
