import { parseAsString, useQueryStates } from "nuqs";

import { PUTAWAY_LIMITS } from "@/constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useWorkspaceWarehouse } from "@/lib/workspace";

import type { ListPutawayParams } from "@/features/putaway/api";
import type { PutawayTextFilters } from "@/features/putaway/selectors";

const PARSERS = {
  receipt: parseAsString,
  // Lọc chữ — chỉ lọc phía FE trên dòng đã tải, KHÔNG gửi BE (BE không có tìm kiếm; gõ chữ không gọi lại API). Một ô tìm duy nhất (S01-5).
  q: parseAsString.withDefault(""),
};

const CLEARED = { receipt: null, q: null };

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
  };
  const hasFilters = filters.receipt !== null || filters.q.trim() !== "";
  return {
    filters,
    warehouseId,
    params,
    text,
    hasTextFilter: filters.q.trim() !== "",
    hasFilters,
    set: (patch: Partial<typeof filters>) => void setFilters(patch),
    clearText: () => void setFilters({ q: null }),
    reset: () => void setFilters(CLEARED),
  };
}

export type PutawayFiltersState = ReturnType<typeof usePutawayFilters>;
