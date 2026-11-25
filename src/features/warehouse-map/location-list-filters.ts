/**
 * Lọc + phân trang danh sách vị trí — thuần, chạy phía FE trên dòng đã dựng (`buildLocationRows`): BE không có API
 * liệt kê vị trí nên gõ tìm không gọi lại API (data-table-mode-a §4.1).
 */

import type { LocationKind, LocationStockFilter } from "@/constants";
import type { LocationRow } from "./location-list-selectors";
import type { LocationStatus } from "./types";

export interface LocationFilters {
  q: string;
  code: string;
  sku: string;
  kind: LocationKind | null;
  zone: string | null;
  shelf: string | null;
  status: LocationStatus | null;
  stock: LocationStockFilter | null;
}

export const EMPTY_LOCATION_FILTERS: LocationFilters = {
  q: "",
  code: "",
  sku: "",
  kind: null,
  zone: null,
  shelf: null,
  status: null,
  stock: null,
};

/** Giá trị lọc "Không thuộc zone" (khu vực, kệ chưa gán zone). */
export const NO_ZONE = "none";

const byCode = (a: string, b: string) => a.localeCompare(b, "vi", { numeric: true });
const uniqueSorted = (values: (string | null | undefined)[]) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))].sort(byCode);

const norm = (value: string) => value.trim().toLocaleLowerCase("vi");
const has = (haystack: string, needle: string) => haystack.toLocaleLowerCase("vi").includes(needle);

export function filterLocationRows(
  rows: readonly LocationRow[],
  filters: LocationFilters,
): LocationRow[] {
  const q = norm(filters.q);
  const code = norm(filters.code);
  const sku = norm(filters.sku);
  return rows.filter((row) => {
    const skus = row.stock?.skus ?? [];
    if (q && !has(row.locationCode, q) && !skus.some((s) => has(s, q))) return false;
    if (code && !has(row.locationCode, code)) return false;
    // Không đọc được tồn → bỏ qua lọc theo hàng, không trả rỗng sai
    if (row.stock && sku && !skus.some((s) => has(s, sku))) return false;
    if (filters.kind && row.kind !== filters.kind) return false;
    if (filters.zone && (row.zoneId ?? NO_ZONE) !== filters.zone) return false;
    if (filters.shelf && row.shelfCode !== filters.shelf) return false;
    if (filters.status && row.status !== filters.status) return false;
    if (row.stock && filters.stock && skus.length > 0 !== (filters.stock === "stocked"))
      return false;
    return true;
  });
}

/** Lựa chọn của các bộ lọc trên header — chỉ giá trị có trong danh sách; label zone null = "Không thuộc zone". */
export function locationFilterOptions(rows: readonly LocationRow[]) {
  const zones = new Map<string, string | null>();
  for (const row of rows) if (row.zoneId) zones.set(row.zoneId, row.zoneName);
  const named = [...zones].map(([value, label]) => ({ value, label }));
  named.sort((a, b) => byCode(a.label ?? a.value, b.label ?? b.value));
  return {
    zones: rows.some((row) => !row.zoneId) ? [...named, { value: NO_ZONE, label: null }] : named,
    shelves: uniqueSorted(rows.map((row) => row.shelfCode)),
    statuses: uniqueSorted(rows.map((row) => row.status)),
  };
}

/** Một trang (từ 0) của danh sách đã lọc; trang vượt quá (lọc hẹp lại) → trang cuối còn dữ liệu. */
export function pageOfRows<T>(rows: readonly T[], page: number, size: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const safe = Math.min(Math.max(0, page), totalPages - 1);
  return {
    items: rows.slice(safe * size, safe * size + size),
    page: safe,
    totalPages,
    total: rows.length,
  };
}
