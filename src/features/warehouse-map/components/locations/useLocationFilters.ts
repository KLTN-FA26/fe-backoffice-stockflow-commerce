import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

import { LOCATION_KINDS, LOCATION_STATUSES, LOCATION_STOCK_FILTERS } from "@/constants";

import type { LocationFilters } from "@/features/warehouse-map/location-list-filters";

const PARSERS = {
  q: parseAsString.withDefault(""),
  code: parseAsString.withDefault(""),
  sku: parseAsString.withDefault(""),
  kind: parseAsStringLiteral(LOCATION_KINDS),
  zone: parseAsString,
  shelf: parseAsString,
  status: parseAsStringLiteral(LOCATION_STATUSES),
  stock: parseAsStringLiteral(LOCATION_STOCK_FILTERS),
  // Trang hiển thị từ 1 trên URL; bảng dùng trang từ 0
  page: parseAsInteger.withDefault(1),
};

const CLEARED = {
  q: null,
  code: null,
  sku: null,
  kind: null,
  zone: null,
  shelf: null,
  status: null,
  stock: null,
  page: null,
};

/**
 * Bộ lọc danh sách vị trí trên URL (state-persistence: link gửi đồng nghiệp thấy cùng thứ). Mọi lọc chạy phía FE —
 * BE không có API liệt kê vị trí, nên gõ tìm không gọi lại API. Đổi lọc → về trang 1.
 */
export function useLocationFilters() {
  const [state, setState] = useQueryStates(PARSERS);
  const { page, ...rest } = state;
  const filters: LocationFilters = rest;
  const hasColumnSearch = filters.code.trim() !== "" || filters.sku.trim() !== "";
  const hasFilters =
    filters.q.trim() !== "" ||
    hasColumnSearch ||
    filters.kind !== null ||
    filters.zone !== null ||
    filters.shelf !== null ||
    filters.status !== null ||
    filters.stock !== null;
  return {
    filters,
    page: Math.max(0, page - 1),
    hasColumnSearch,
    hasFilters,
    set: (patch: Partial<LocationFilters>) => void setState({ ...patch, page: null }),
    setPage: (next: number) => void setState({ page: next <= 0 ? null : next + 1 }),
    reset: () => void setState(CLEARED),
  };
}

export type LocationFiltersState = ReturnType<typeof useLocationFilters>;
