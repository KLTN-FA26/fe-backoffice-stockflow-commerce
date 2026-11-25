import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

import { CARTON_FILTER_STATUSES, CARTON_LIST_LIMITS, CARTON_SORTS } from "@/constants";
import { STOCK_STATUSES } from "@/constants/inventory";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

import type { CartonListParams } from "@/features/inventory/carton-schemas";

const DIRECTIONS = ["asc", "desc"] as const;

const PARSERS = {
  q: parseAsString.withDefault(""),
  warehouse: parseAsString,
  sku: parseAsString.withDefault(""),
  location: parseAsString.withDefault(""),
  lot: parseAsString.withDefault(""),
  stockStatus: parseAsStringLiteral(STOCK_STATUSES),
  // Vắng = mặc định của BE: thùng còn sống (RECEIVING, IN_STOCK)
  status: parseAsStringLiteral(CARTON_FILTER_STATUSES),
  sort: parseAsStringLiteral(CARTON_SORTS),
  dir: parseAsStringLiteral(DIRECTIONS),
  // Trang hiển thị từ 1 trên URL; BE trang từ 0
  page: parseAsInteger.withDefault(1),
  /** Thùng đang mở chi tiết — link gửi đồng nghiệp mở thẳng thùng đó. */
  lpn: parseAsString,
};

type State = ReturnType<typeof useQueryStates<typeof PARSERS>>[0];
export type CartonFilterPatch = Partial<Omit<State, "page" | "lpn">>;

const CLEARED = {
  q: null,
  warehouse: null,
  sku: null,
  location: null,
  lot: null,
  stockStatus: null,
  status: null,
  sort: null,
  dir: null,
  page: null,
};

/**
 * Bộ lọc màn Thùng hàng trên URL (state-persistence). Mọi lọc đều là tham số BE (docs 20 §4.1, BE #454) — search và
 * lọc chữ debounce 300ms trước khi thành tham số, đổi lọc → về trang 1. Sort / trang không tính là "đang lọc".
 */
export function useCartonFilters(pageSize: number) {
  const [state, setState] = useQueryStates(PARSERS);
  const delay = CARTON_LIST_LIMITS.searchDebounceMs;
  const q = useDebouncedValue(state.q, delay);
  const sku = useDebouncedValue(state.sku, delay);
  const location = useDebouncedValue(state.location, delay);
  const lot = useDebouncedValue(state.lot, delay);
  const page = Math.max(0, state.page - 1);
  const params: CartonListParams = {
    page,
    size: pageSize,
    q,
    warehouseId: state.warehouse ?? undefined,
    sku,
    location,
    lotNumber: lot,
    status: state.status ? [state.status] : undefined,
    stockStatus: state.stockStatus ? [state.stockStatus] : undefined,
    sort: state.sort ?? undefined,
    direction: state.dir ?? undefined,
  };
  const hasColumnSearch = [state.sku, state.location, state.lot].some((v) => v.trim() !== "");
  const hasFilters =
    state.q.trim() !== "" ||
    hasColumnSearch ||
    state.warehouse !== null ||
    state.stockStatus !== null ||
    state.status !== null;
  return {
    state,
    params,
    page,
    hasColumnSearch,
    hasFilters,
    set: (patch: CartonFilterPatch) => void setState({ ...patch, page: null }),
    setPage: (next: number) => void setState({ page: next <= 0 ? null : next + 1 }),
    openDetail: (lpn: string | null) => void setState({ lpn }),
    reset: () => void setState(CLEARED),
  };
}

export type CartonFiltersState = ReturnType<typeof useCartonFilters>;
