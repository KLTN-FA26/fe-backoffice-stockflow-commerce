import { parseAsString, useQueryState } from "nuqs";

import { PICK_LINE_LIMITS } from "@/constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePutBacks } from "@/features/fulfillment/queries";

import type { PutBackRow } from "@/features/fulfillment/types";

export type PutBackEmptyState = "none" | "no-rows" | "no-rows-in-warehouse" | "no-match";

const matches = (row: PutBackRow, needle: string) =>
  [row.orderNumber, row.sku, row.fromLocationCode].some((value) =>
    value.toLowerCase().includes(needle),
  );

/**
 * State hàng đợi trả về kệ — kho + từ khoá trên URL (nuqs: gửi link / F5 giữ nguyên). BE trả một trang
 * 200 dòng cũ nhất, không có tìm kiếm: từ khoá lọc ở client trên trang đó (số đơn, SKU, vị trí lấy,
 * không phân biệt hoa thường); `truncated` khi còn dòng ngoài trang.
 */
export function usePutBackListState(canRead: boolean) {
  const [warehouse, setWarehouseParam] = useQueryState("warehouse", parseAsString);
  const [q, setQParam] = useQueryState("q", parseAsString.withDefault(""));
  const needle = useDebouncedValue(q.trim().toLowerCase(), PICK_LINE_LIMITS.searchDebounceMs);
  const query = usePutBacks(warehouse, canRead);

  const data = query.data;
  const rows = data ? data.items.filter((row) => !needle || matches(row, needle)) : [];
  const emptyState: PutBackEmptyState = !data
    ? "none"
    : data.items.length === 0
      ? warehouse
        ? "no-rows-in-warehouse"
        : "no-rows"
      : rows.length === 0
        ? "no-match"
        : "none";

  const setWarehouse = (value: string | null) => void setWarehouseParam(value);
  const setQ = (value: string) => void setQParam(value || null);
  return {
    query,
    rows,
    warehouse,
    q,
    emptyState,
    truncated: !!data && data.totalElements > data.items.length,
    hasFilters: warehouse !== null || q !== "",
    setWarehouse,
    setQ,
    clearFilters: () => {
      setWarehouse(null);
      setQ("");
    },
  };
}

export type PutBackListState = ReturnType<typeof usePutBackListState>;
