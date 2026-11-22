import { parseAsString, useQueryStates } from "nuqs";

import { PUTAWAY_LIMITS } from "@/constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

import type { ListPutawayParams } from "@/features/putaway/api";
import type { PutawayTextFilters } from "@/features/putaway/selectors";

const PARSERS = {
  warehouse: parseAsString,
  receipt: parseAsString,
  // Lọc chữ — chỉ lọc phía FE trên dòng đã tải, KHÔNG gửi BE (BE không có tìm kiếm; gõ chữ không gọi lại API)
  q: parseAsString.withDefault(""),
  lpn: parseAsString.withDefault(""),
  sku: parseAsString.withDefault(""),
  location: parseAsString.withDefault(""),
};

const CLEARED = { warehouse: null, receipt: null, q: null, lpn: null, sku: null, location: null };

/**
 * Bộ lọc màn cất hàng trên URL (state-persistence: người khác mở link thấy cùng thứ). BE bắt buộc kho hoặc phiếu nhập
 * (docs 05 §4.2 "theo kho hoặc theo phiếu"): `?receipt=` thắng `?warehouse=`. Chưa chọn kho mà người dùng chỉ thấy
 * một kho → dùng luôn kho đó (không ghi lên URL, F5 vẫn ra cùng kết quả).
 */
export function usePutawayFilters(onlyWarehouseId: string | null) {
  const [filters, setFilters] = useQueryStates(PARSERS);
  const warehouseId = filters.warehouse ?? onlyWarehouseId;
  const params: ListPutawayParams = filters.receipt
    ? { receiptId: filters.receipt }
    : warehouseId
      ? { warehouseId }
      : {};
  const debouncedQ = useDebouncedValue(filters.q, PUTAWAY_LIMITS.searchDebounceMs);
  const text: PutawayTextFilters = {
    q: debouncedQ,
    lpn: filters.lpn,
    sku: filters.sku,
    location: filters.location,
  };
  const hasColumnSearch = [filters.lpn, filters.sku, filters.location].some((f) => f.trim() !== "");
  const hasFilters =
    filters.warehouse !== null ||
    filters.receipt !== null ||
    filters.q.trim() !== "" ||
    hasColumnSearch;
  return {
    filters,
    warehouseId,
    params,
    /** Đủ tham số để gọi BE (có kho hoặc phiếu nhập). */
    ready: Boolean(params.receiptId || params.warehouseId),
    text,
    hasColumnSearch,
    hasTextFilter: filters.q.trim() !== "" || hasColumnSearch,
    hasFilters,
    set: (patch: Partial<typeof filters>) => void setFilters(patch),
    clearText: () => void setFilters({ q: null, lpn: null, sku: null, location: null }),
    reset: () => void setFilters(CLEARED),
  };
}

export type PutawayFiltersState = ReturnType<typeof usePutawayFilters>;
