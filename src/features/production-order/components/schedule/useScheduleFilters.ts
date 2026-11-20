import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";

import { isValidIsoDay } from "@/lib/date-range";

import type { ProductionScheduleParams } from "@/features/production-order/schedule-schemas";
import type { ScheduleTextFilters } from "@/features/production-order/schedule-selectors";

const PARSERS = {
  producerId: parseAsString,
  warehouseId: parseAsString,
  from: parseAsString,
  to: parseAsString,
  alertsOnly: parseAsBoolean.withDefault(false),
  // Lọc chữ — chỉ lọc phía FE trên dòng đã tải, KHÔNG gửi lên BE (đổi chữ không gọi lại lịch)
  q: parseAsString.withDefault(""),
  code: parseAsString.withDefault(""),
  order: parseAsString.withDefault(""),
};

const CLEARED = {
  producerId: null,
  warehouseId: null,
  from: null,
  to: null,
  alertsOnly: null,
  q: null,
  code: null,
  order: null,
};

/** Ngày trên URL không phải yyyy-MM-dd thật (link sửa tay) → bỏ, BE sẽ trả 400 cho cả màn. */
const validDay = (value: string | null): string | undefined =>
  value !== null && isValidIsoDay(value) ? value : undefined;

/**
 * Bộ lọc lịch sản xuất trên URL (state-persistence: người khác mở link thấy cùng thứ): đơn vị sản xuất, kho, khoảng
 * ngày, chỉ dòng có cảnh báo (docs 17 §4.12 bước 47) gửi BE; search chính + search trong cột lọc phía FE. Khoảng
 * ngày ngược → không gửi lên BE, báo lỗi tại chỗ.
 */
export function useScheduleFilters() {
  const [filters, setFilters] = useQueryStates(PARSERS);
  const from = validDay(filters.from);
  const to = validDay(filters.to);
  // BE ProductionScheduleService: from sau to → 400 VALIDATION_FAILED
  const rangeInvalid = Boolean(from && to && from > to);
  const params: ProductionScheduleParams = {
    producerId: filters.producerId ?? undefined,
    warehouseId: filters.warehouseId ?? undefined,
    from: rangeInvalid ? undefined : from,
    to: rangeInvalid ? undefined : to,
    alertsOnly: filters.alertsOnly || undefined,
  };
  const text: ScheduleTextFilters = { q: filters.q, code: filters.code, order: filters.order };
  const hasColumnSearch = filters.code.trim() !== "" || filters.order.trim() !== "";
  const hasFilters =
    filters.producerId !== null ||
    filters.warehouseId !== null ||
    filters.from !== null ||
    filters.to !== null ||
    filters.alertsOnly ||
    filters.q.trim() !== "" ||
    hasColumnSearch;
  return {
    filters,
    params,
    text,
    rangeInvalid,
    hasColumnSearch,
    hasFilters,
    set: (patch: Partial<typeof filters>) => void setFilters(patch),
    reset: () => void setFilters(CLEARED),
  };
}

export type ScheduleFiltersState = ReturnType<typeof useScheduleFilters>;
