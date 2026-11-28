import { parseAsString, useQueryState } from "nuqs";

import { PAGE_SIZE, PRODUCT_PERMISSIONS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePageConfig } from "@/hooks/use-page-config";
import { useUrlFilters } from "@/hooks/use-url-filters";

/** Bộ lọc cờ `active` của BE (một giá trị, không truyền = tất cả). */
export const TAXONOMY_STATUS_FILTERS = ["active", "inactive"] as const;
export type TaxonomyStatusFilter = (typeof TAXONOMY_STATUS_FILTERS)[number];
export const TAXONOMY_PAGE_SIZES = [PAGE_SIZE.sm, PAGE_SIZE.md, PAGE_SIZE.lg, PAGE_SIZE.xl];

/** Sở thích hiển thị (localStorage) — tìm kiếm / lọc / trang nằm trên URL (state-persistence.md). */
interface TaxonomyPageConfig {
  visibleColumns: string[];
  pageSize: number;
}

const sameColumns = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((c) => b.includes(c));

/**
 * Khoá URL của ô lọc trên header cột Mã / Tên — riêng từng tab (`brandCode`, `categoryName`…), tách
 * khỏi ô tìm chính `q`. `TaxonomyManager` xoá cả bộ khi đổi tab.
 */
export const columnFilterKeys = (tab: "brand" | "category") => ({
  code: `${tab}Code`,
  name: `${tab}Name`,
});

/** State danh sách dùng chung cho tab Thương hiệu và Danh mục (cấu hình cột lưu riêng từng tab). */
export function useTaxonomyListState(
  storageKey: string,
  allColumns: readonly string[],
  tab: "brand" | "category",
) {
  const can = usePermissionChecker();
  // UI-only — Backend phải re-check (@RequiresPermission product-products:READ) — thiếu thì không gọi API
  const canRead = can(PRODUCT_PERMISSIONS.read);
  // Tìm kiếm / lọc / trang trên URL (`q`, `status`, `page`) — đổi lọc tự về trang 1, `debouncedQ` 300ms
  const url = useUrlFilters(TAXONOMY_STATUS_FILTERS);
  // BE chỉ có cờ `active` (một giá trị) → chọn một trạng thái thì thay cái đang chọn
  const status: TaxonomyStatusFilter | null = url.status[0] ?? null;
  const { q, debouncedQ, page, setPage } = url;
  const keys = columnFilterKeys(tab);
  const [code, setCodeUrl] = useQueryState(keys.code, parseAsString.withDefault(""));
  const [name, setNameUrl] = useQueryState(keys.name, parseAsString.withDefault(""));
  const debouncedCode = useDebouncedValue(code, 300).trim();
  const debouncedName = useDebouncedValue(name, 300).trim();
  const columnFilter = (set: (value: string | null) => unknown) => (value: string) => {
    void set(value || null);
    void setPage(1);
  };
  const defaultColumns = [...allColumns];
  const { config, updateConfig } = usePageConfig<TaxonomyPageConfig>(
    storageKey,
    { visibleColumns: defaultColumns, pageSize: PAGE_SIZE.md },
    (stored, fallback) => ({ ...fallback, ...stored }),
  );

  return {
    canRead,
    config,
    q,
    status,
    /** Ô lọc header cột Mã / Tên (giá trị đang gõ). */
    code,
    name,
    /** Giá trị đã debounce — dùng để lọc dòng theo đúng cột (`matchesColumnFilters`). */
    columnFilters: { code: debouncedCode, name: debouncedName },
    // Cùng giá trị đã debounce với `params` — nếu không, cây ↔ phẳng đổi trước khi dữ liệu lọc về
    filtered: Boolean(debouncedQ.trim() || status || debouncedCode || debouncedName),
    /** Tham số chung cho `GET /brands` / `GET /categories` (trang URL đếm từ 1, BE từ 0). */
    params: {
      page: Math.max(0, page - 1),
      size: config.pageSize,
      // BE chỉ có một `q` (mã HOẶC tên): ô tìm chính ưu tiên; không có thì gửi chữ của ô lọc cột để
      // thu hẹp, rồi lọc đúng theo cột trên các dòng nhận về (như trang Sản phẩm)
      q: debouncedQ.trim() || debouncedCode || debouncedName || undefined,
      active: status === null ? undefined : status === "active",
    },
    setQ: url.setQ,
    setStatus: (value: TaxonomyStatusFilter | null) => url.setStatus(value ? [value] : []),
    setCode: columnFilter(setCodeUrl),
    setName: columnFilter(setNameUrl),
    setPage,
    resetFilters: () => {
      url.setStatus([]);
      url.setQ("");
      void setCodeUrl(null);
      void setNameUrl(null);
    },
    toggleColumn: (column: string) =>
      updateConfig((c) => ({
        ...c,
        visibleColumns: c.visibleColumns.includes(column)
          ? c.visibleColumns.filter((x) => x !== column)
          : [...c.visibleColumns, column],
      })),
    resetColumns: () => updateConfig((c) => ({ ...c, visibleColumns: defaultColumns })),
    hasColumnConfig: !sameColumns(config.visibleColumns, defaultColumns),
    changePageSize: (pageSize: number) => {
      updateConfig((c) => ({ ...c, pageSize }));
      void setPage(1);
    },
  };
}

export type TaxonomyListState = ReturnType<typeof useTaxonomyListState>;
