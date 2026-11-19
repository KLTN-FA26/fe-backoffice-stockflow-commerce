"use client";

import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";

import { INVENTORY_PAGE_SIZES } from "@/constants/inventory";
import { QUARANTINE_STORAGE_KEYS } from "@/constants/quarantine";
import { PAGE_SIZE } from "@/constants/table";

import { usePageConfig } from "@/hooks/use-page-config";

interface QuarantineListConfig {
  pageSize: number;
}

const DEFAULT_CONFIG: QuarantineListConfig = { pageSize: PAGE_SIZE.md };

// Mã khu, SKU, trang một-based và LPN đang xem nằm trên URL (nuqs) — F5 / gửi link giữ nguyên; cỡ trang là tuỳ chọn của
// trình duyệt (state-persistence).
const PARSERS = {
  location: parseAsString.withDefault(""),
  sku: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
  lpn: parseAsString.withDefault(""),
};

function mergeConfig(
  stored: Partial<QuarantineListConfig>,
  fallback: QuarantineListConfig,
): QuarantineListConfig {
  const pageSize = INVENTORY_PAGE_SIZES.find((size) => size === stored.pageSize);
  return { pageSize: pageSize ?? fallback.pageSize };
}

/**
 * Bộ lọc của danh sách khu cách ly. `defaultLocation` (khu QUARANTINE đầu tiên của kho đang chọn) dùng khi URL chưa có
 * `location` — không ghi vào URL để đổi kho thì mặc định đổi theo.
 */
export function useQuarantineFilters(defaultLocation: string | null) {
  const [query, setQuery] = useQueryStates(PARSERS);
  const { config, updateConfig } = usePageConfig(
    QUARANTINE_STORAGE_KEYS.list,
    DEFAULT_CONFIG,
    mergeConfig,
  );
  return {
    location: query.location || defaultLocation || "",
    sku: query.sku,
    lpn: query.lpn,
    hasFilters: Boolean(query.location || query.sku),
    page: Math.max(1, query.page),
    size: config.pageSize,
    // Đổi bộ lọc quay về trang đầu trong cùng một lần cập nhật URL.
    applyFilters: (location: string, sku: string) =>
      setQuery({
        location: location.trim().toUpperCase() || null,
        sku: sku.trim().toUpperCase() || null,
        page: null,
      }),
    setPage: (page: number) => setQuery({ page }),
    setSize: (pageSize: number) => {
      updateConfig((current) => ({ ...current, pageSize }));
      void setQuery({ page: null });
    },
    openCarton: (lpn: string) => setQuery({ lpn }),
    closeCarton: () => setQuery({ lpn: null }),
    reset: () => setQuery({ location: null, sku: null, page: null }),
  };
}
