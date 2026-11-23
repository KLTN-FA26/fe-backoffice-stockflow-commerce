import { parseAsString, useQueryStates } from "nuqs";

import { PUTAWAY_LIMITS } from "@/constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useWorkspaceWarehouse } from "@/lib/workspace";

import type { ListPutawayParams } from "@/features/putaway/api";
import type { PutawayTextFilters } from "@/features/putaway/selectors";

const PARSERS = {
  receipt: parseAsString,
  // Lọc chữ — chỉ lọc phía FE trên dòng đã tải, KHÔNG gửi BE (BE không có tìm kiếm; gõ chữ không gọi lại API)
  q: parseAsString.withDefault(""),
  lpn: parseAsString.withDefault(""),
  sku: parseAsString.withDefault(""),
  location: parseAsString.withDefault(""),
};

const CLEARED = { receipt: null, q: null, lpn: null, sku: null, location: null };

/**
 * Bộ lọc màn cất hàng trên URL (state-persistence: người khác mở link thấy cùng thứ). BE bắt buộc kho hoặc phiếu nhập
 * (docs 05 §4.2 "theo kho hoặc theo phiếu"): kho là kho của tab (đường dẫn), `?receipt=` (từ phiếu nhận) thắng kho.
 */
export function usePutawayFilters() {
  const [filters, setFilters] = useQueryStates(PARSERS);
  const warehouseId = useWorkspaceWarehouse().id;
  const params: ListPutawayParams = filters.receipt
    ? { receiptId: filters.receipt }
    : { warehouseId };
  const debouncedQ = useDebouncedValue(filters.q, PUTAWAY_LIMITS.searchDebounceMs);
  const text: PutawayTextFilters = {
    q: debouncedQ,
    lpn: filters.lpn,
    sku: filters.sku,
    location: filters.location,
  };
  const hasColumnSearch = [filters.lpn, filters.sku, filters.location].some((f) => f.trim() !== "");
  const hasFilters = filters.receipt !== null || filters.q.trim() !== "" || hasColumnSearch;
  return {
    filters,
    warehouseId,
    params,
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
