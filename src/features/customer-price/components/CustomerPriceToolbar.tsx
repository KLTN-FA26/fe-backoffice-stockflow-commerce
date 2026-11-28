"use client";

import { useQueryStates } from "nuqs";

import { CUSTOMER_PRICE_UI_LABELS, STORAGE_KEYS } from "@/constants";

import {
  columnSummaryItem,
  columnToolbarProps,
  useColumnVisibility,
} from "@/hooks/use-column-visibility";

import { ListToolbar } from "@/components/shared/ListToolbar";

import { CLEARED_PRICE_TABLE_PARAMS, PRICE_TABLE_PARSERS } from "./price-table-params";

import type { PriceColumnFilters } from "../selectors";
import type { PriceTableParam } from "./price-table-params";

const L = CUSTOMER_PRICE_UI_LABELS;
const B = L.toolbar;

export const PRICE_COLUMN_KEYS = [
  "sku",
  "moq",
  "tiers",
  "lowest",
  "highest",
  "note",
  "edit",
] as const;
export type PriceColumn = (typeof PRICE_COLUMN_KEYS)[number];
const COLUMN_LABELS: Record<PriceColumn, string> = {
  sku: L.field.sku,
  moq: L.field.moq,
  tiers: L.table.tierCount,
  lowest: L.table.lowest,
  highest: L.table.highest,
  note: L.field.note,
  edit: "Thao tác",
};
/** Cột SKU (mở chi tiết) và cột thao tác luôn hiện (data-table-mode-a §4.2). */
const LOCKED: readonly PriceColumn[] = ["sku", "edit"];

/**
 * Ô tìm SKU + lọc trên header từng cột (URL, `price-table-params`) + ẩn hiện cột (localStorage). BE trả cả mảng giá của
 * khách, nên lọc ở FE là lọc trên toàn bộ bảng giá của khách đó.
 */
export function usePriceTableState() {
  const [v, setValues] = useQueryStates(PRICE_TABLE_PARSERS);
  const columns = useColumnVisibility(STORAGE_KEYS.adminCustomerPricesColumns, PRICE_COLUMN_KEYS, {
    locked: LOCKED,
  });
  const columnFilters: PriceColumnFilters = {
    sku: v.cpSku,
    moqFrom: v.cpMoqFrom,
    moqTo: v.cpMoqTo,
    tiersFrom: v.cpTiersFrom,
    tiersTo: v.cpTiersTo,
    lowestFrom: v.cpLowFrom,
    lowestTo: v.cpLowTo,
    highestFrom: v.cpHighFrom,
    highestTo: v.cpHighTo,
  };
  const hasColumnFilters = Object.values(columnFilters).some((value) => value.trim() !== "");
  return {
    q: v.cpQ,
    columnFilters,
    hasColumnFilters,
    hasFilters: v.cpQ.trim() !== "" || hasColumnFilters,
    columns,
    /** Đặt một hoặc nhiều khoá; chuỗi rỗng = bỏ khỏi URL. */
    set: (next: Partial<Record<PriceTableParam, string>>) =>
      void setValues(
        Object.fromEntries(Object.entries(next).map(([key, value]) => [key, value || null])),
      ),
    clearColumnFilters: () => void setValues({ ...CLEARED_PRICE_TABLE_PARAMS, cpQ: v.cpQ || null }),
    clear: () => void setValues(CLEARED_PRICE_TABLE_PARAMS),
  };
}
export type PriceTableState = ReturnType<typeof usePriceTableState>;

/** Tóm tắt lọc cột đang bật, vd `SKU “LYP”, Số bậc 2–…`. */
function columnSearchSummary({ columnFilters: f }: PriceTableState): string {
  const range = (label: string, from: string, to: string) =>
    (from || to) && `${label} ${from || "…"}–${to || "…"}`;
  return [
    f.sku.trim() && `${L.field.sku} “${f.sku.trim()}”`,
    range(L.field.moq, f.moqFrom, f.moqTo),
    range(L.table.tierCount, f.tiersFrom, f.tiersTo),
    range(L.table.lowest, f.lowestFrom, f.lowestTo),
    range(L.table.highest, f.highestFrom, f.highestTo),
  ]
    .filter(Boolean)
    .join(", ");
}

/** Thanh tìm + cấu hình kiểu Vercel (backoffice-erp-ui §2–3) của bảng giá một khách. */
export function CustomerPriceToolbar({ state }: { state: PriceTableState }) {
  const { q, columns } = state;
  return (
    <ListToolbar<never, never, PriceColumn>
      {...columnToolbarProps(columns, COLUMN_LABELS, PRICE_COLUMN_KEYS)}
      controlsIn="summary"
      search={q}
      onSearchChange={(value) => state.set({ cpQ: value })}
      searchPlaceholder={L.table.filter}
      // Chỉ hiện ô tìm / tìm trong cột khi đang dùng — không có viên "Chưa dùng" hay "Trường search" (rà UI WF-02 bo-16).
      summaryItems={[
        ...(q.trim()
          ? [
              {
                label: B.searchSummary,
                value: `“${q}”`,
                active: true,
                onClear: () => state.set({ cpQ: "" }),
              },
            ]
          : []),
        ...(state.hasColumnFilters
          ? [
              {
                label: B.columnSearch,
                value: columnSearchSummary(state),
                active: true,
                onClear: state.clearColumnFilters,
              },
            ]
          : []),
        columnSummaryItem(columns),
      ]}
      onResetAll={() => {
        state.clear();
        columns.reset();
      }}
      resetDisabled={!state.hasFilters && !columns.hasColumnConfig}
    />
  );
}
