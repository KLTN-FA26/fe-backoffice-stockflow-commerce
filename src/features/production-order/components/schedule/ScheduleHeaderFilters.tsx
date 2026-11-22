"use client";

import {
  PRODUCTION_LABELS,
  PRODUCTION_SCHEDULE_COLUMNS as C,
  SHORT_BATCH_COLUMNS as B,
} from "@/constants";

import { ColumnFilterButton, HeaderOptionFilter } from "@/components/shared/ColumnHeaderFilter";

import { shortId } from "../parts";
import { AlertsFilter, DateRangeFilter } from "./ScheduleFilterControls";

import type { ReactNode } from "react";
import type { HeaderFilterOption } from "@/components/shared/ColumnHeaderFilter";
import type { ScheduleFiltersState } from "./useScheduleFilters";

const L = PRODUCTION_LABELS.schedule;
const D = PRODUCTION_LABELS.drawUp;

/**
 * Giá trị đang lọc trên URL mà danh mục không có (không có quyền đọc danh mục, đang tải, lỗi) vẫn phải có ô lọc —
 * nếu không màn bị lọc ngầm mà không có chỗ bỏ.
 */
export function withCurrent(
  options: HeaderFilterOption[],
  value: string | null,
): HeaderFilterOption[] {
  if (value === null || options.some((option) => option.value === value)) return options;
  return [...options, { value, label: shortId(value) }];
}

export interface ScheduleFilterOptions {
  producers: HeaderFilterOption[];
  warehouses: HeaderFilterOption[];
}

type HeaderFilters = Partial<Record<string, ReactNode>>;

/**
 * Nút lọc trên header hai bảng của lịch. Lọc dùng chung (đơn bán, kho, khoảng ngày, cảnh báo) hiện ở cột tương ứng
 * của CẢ hai bảng và cùng một state trên URL. Đơn vị / kho chỉ có nút khi có lựa chọn (đọc được danh mục hoặc URL
 * đang lọc).
 */
export function scheduleHeaderFilters(
  state: ScheduleFiltersState,
  options: ScheduleFilterOptions,
): { orders: HeaderFilters; batches: HeaderFilters } {
  const { filters, set } = state;
  const col = L.column;
  const text = (label: string, value: string, onChange: (next: string) => void) => (
    <ColumnFilterButton
      label={label}
      value={value}
      placeholder={L.columnSearch(label)}
      onChange={onChange}
    />
  );
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
  const order = (label: string) => text(label, filters.order, (next) => set({ order: next }));
  const warehouse = (label: string) =>
    option(label, options.warehouses, filters.warehouseId, (warehouseId) => set({ warehouseId }));
  return {
    orders: {
      [C.CODE]: text(col.code, filters.code, (code) => set({ code })),
      [C.PRODUCER]: option(col.producer, options.producers, filters.producerId, (producerId) =>
        set({ producerId }),
      ),
      [C.ORDER]: order(col.order),
      [C.WAREHOUSE]: warehouse(col.warehouse),
      [C.NEED_BY]: <DateRangeFilter state={state} label={col.needBy} />,
      [C.ALERTS]: <AlertsFilter state={state} label={col.alerts} />,
    },
    batches: {
      [B.ORDER]: order(D.orderNumber),
      [B.WINDOW]: <DateRangeFilter state={state} label={D.window} />,
      [B.WAREHOUSE]: warehouse(D.warehouse),
      [B.ALERTS]: <AlertsFilter state={state} label={D.alerts} />,
    },
  };
}
