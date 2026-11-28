"use client";

import {
  RETURN_CHANNEL_LABELS,
  RETURN_LABELS,
  RETURN_REASON_LABELS,
} from "@/constants/labels-return";
import { RETURN_CHANNELS, RETURN_REASONS, RETURN_STORAGE_KEYS } from "@/constants/returns";
import { useColumnTextFilters } from "@/hooks/use-column-text-filters";
import { useColumnVisibility } from "@/hooks/use-column-visibility";

import { HeaderOptionFilter, withHeaderFilters } from "@/components/shared/ColumnHeaderFilter";

import { RETURN_FILTER_KEYS } from "../list-filters";

import {
  RETURN_COLUMNS,
  RETURN_LIST_COLUMNS,
  RETURN_LIST_LOCKED,
  VAT_ADJUSTMENT_COLUMNS,
} from "./return-columns";

import type { ColumnTextFilters } from "@/hooks/use-column-text-filters";
import type { ReactNode } from "react";
import type { ReturnFilterKey } from "../list-filters";
import type { ReturnListColumn } from "./return-columns";

const L = RETURN_LABELS;
const H = L.headerFilter;

export const FILTER_LABELS: Record<ReturnFilterKey, string> = {
  rtReason: L.columns.reason,
  rtChannel: L.columns.channel,
};
export const REASON_OPTIONS = RETURN_REASONS.map((value) => ({
  value,
  label: RETURN_REASON_LABELS[value],
}));
export const CHANNEL_OPTIONS = RETURN_CHANNELS.map((value) => ({
  value,
  label: RETURN_CHANNEL_LABELS[value],
}));
export const labelOf = (options: readonly { value: string; label: string }[]) => (code: string) =>
  options.find((option) => option.value === code)?.label ?? code;

/** Nút lọc trên header cột Lý do và Nguồn (chọn một mã; chỉ xét trang đang xem). */
export function returnHeaderFilters(
  columns: ColumnTextFilters<ReturnFilterKey>,
): Partial<Record<ReturnListColumn, ReactNode>> {
  const { values, set } = columns;
  return {
    reason: (
      <HeaderOptionFilter
        label={L.columns.reason.toLocaleLowerCase("vi")}
        value={values.rtReason || null}
        options={REASON_OPTIONS}
        onChange={(value) => set("rtReason", value ?? "")}
        searchPlaceholder={H.reasonSearch}
        emptyLabel={H.empty}
      />
    ),
    channel: (
      <HeaderOptionFilter
        label={L.columns.channel.toLocaleLowerCase("vi")}
        value={values.rtChannel || null}
        options={CHANNEL_OPTIONS}
        onChange={(value) => set("rtChannel", value ?? "")}
        searchPlaceholder={H.channelSearch}
        emptyLabel={H.empty}
      />
    ),
  };
}

/**
 * Cột của bảng theo tab (Kế toán có cột Hoá đơn luôn hiện) + cột đang bật (localStorage) + lọc header cột Lý do / Nguồn
 * (URL). BE không có tham số lý do / nguồn → lọc trên trang đang xem, không gọi lại API.
 */
export function useReturnTableConfig(vatTab: boolean) {
  const headerFilters = useColumnTextFilters(RETURN_FILTER_KEYS);
  const columnState = useColumnVisibility(RETURN_STORAGE_KEYS.listColumns, RETURN_LIST_COLUMNS, {
    locked: RETURN_LIST_LOCKED,
  });
  const columns = withHeaderFilters(
    (vatTab ? VAT_ADJUSTMENT_COLUMNS : RETURN_COLUMNS).filter(
      (column) => column.key === "invoice" || columnState.visible.some((key) => key === column.key),
    ),
    returnHeaderFilters(headerFilters),
  );
  return { headerFilters, columnState, columns };
}
