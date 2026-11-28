import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { CARRIER_STATUSES, PAGE_SIZE } from "@/constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCarriers } from "@/features/shipping/queries";

/** Số dòng một trang của danh mục hãng. */
export const CARRIER_PAGE_SIZES: number[] = [PAGE_SIZE.sm, PAGE_SIZE.md, PAGE_SIZE.lg];
const STATUS_FILTERS = [...CARRIER_STATUSES, "ALL"] as const;

export type CarrierListEmptyState = "none" | "no-carriers" | "no-results" | "invalid-page";

/** State danh mục hãng — trang, từ khoá, trạng thái nằm trên URL (state-persistence.md). */
export function useCarrierListState(canRead: boolean) {
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const [status, setStatus] = useQueryState(
    "status",
    parseAsStringLiteral(STATUS_FILTERS).withDefault("ALL"),
  );
  // Số dòng một trang chọn được (S20-3): trên URL như trang và bộ lọc
  const [size, setSize] = useQueryState("size", parseAsInteger.withDefault(PAGE_SIZE.md));
  const pageSize = CARRIER_PAGE_SIZES.includes(size) ? size : PAGE_SIZE.md;
  const debouncedQ = useDebouncedValue(q, 300);
  const query = useCarriers(
    {
      page: Math.max(0, page - 1),
      size: pageSize,
      search: debouncedQ,
      status: status === "ALL" ? undefined : status,
    },
    { enabled: canRead },
  );
  const hasFilters = q.trim() !== "" || status !== "ALL";
  const dataFiltered = debouncedQ.trim() !== "" || status !== "ALL";
  const data = query.data;
  let emptyState: CarrierListEmptyState = "none";
  if (data && data.totalElements === 0) emptyState = dataFiltered ? "no-results" : "no-carriers";
  else if (data && data.items.length === 0) emptyState = "invalid-page";

  return {
    canRead,
    query,
    q,
    status,
    pageSize,
    changePageSize: (next: number) => {
      void setSize(next === PAGE_SIZE.md ? null : next);
      void setPage(1);
    },
    hasFilters,
    emptyState,
    setPage: (value: number) => void setPage(value),
    setQ: (value: string) => {
      void setQ(value);
      void setPage(1);
    },
    setStatus: (value: string) => {
      void setStatus(STATUS_FILTERS.find((known) => known === value) ?? "ALL");
      void setPage(1);
    },
    clearFilters: () => {
      void setQ(null);
      void setStatus(null);
      void setPage(1);
    },
  };
}

export type CarrierListState = ReturnType<typeof useCarrierListState>;
