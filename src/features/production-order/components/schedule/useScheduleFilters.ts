import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";

import type { ProductionScheduleParams } from "@/features/production-order/schedule-schemas";

const PARSERS = {
  producerId: parseAsString,
  warehouseId: parseAsString,
  from: parseAsString,
  to: parseAsString,
  alertsOnly: parseAsBoolean.withDefault(false),
};

/**
 * Bộ lọc lịch sản xuất trên URL (state-persistence: người khác mở link thấy cùng thứ): đơn vị sản xuất, kho, khoảng
 * ngày, chỉ dòng có cảnh báo (docs 17 §4.12 bước 47). Khoảng ngày ngược → không gửi lên BE, báo lỗi tại chỗ.
 */
export function useScheduleFilters() {
  const [filters, setFilters] = useQueryStates(PARSERS);
  const rangeInvalid = Boolean(filters.from && filters.to && filters.from > filters.to);
  const params: ProductionScheduleParams = {
    producerId: filters.producerId ?? undefined,
    warehouseId: filters.warehouseId ?? undefined,
    from: rangeInvalid ? undefined : (filters.from ?? undefined),
    to: rangeInvalid ? undefined : (filters.to ?? undefined),
    alertsOnly: filters.alertsOnly || undefined,
  };
  const hasFilters =
    filters.producerId !== null ||
    filters.warehouseId !== null ||
    filters.from !== null ||
    filters.to !== null ||
    filters.alertsOnly;
  return {
    filters,
    params,
    rangeInvalid,
    hasFilters,
    set: (patch: Partial<typeof filters>) => void setFilters(patch),
    reset: () =>
      void setFilters({
        producerId: null,
        warehouseId: null,
        from: null,
        to: null,
        alertsOnly: null,
      }),
  };
}

export type ScheduleFiltersState = ReturnType<typeof useScheduleFilters>;
