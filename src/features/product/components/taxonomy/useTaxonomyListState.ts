import { PAGE_SIZE, PRODUCT_PERMISSIONS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
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

/** State danh sách dùng chung cho tab Thương hiệu và Danh mục (cấu hình cột lưu riêng từng tab). */
export function useTaxonomyListState(storageKey: string, allColumns: readonly string[]) {
  const can = usePermissionChecker();
  // UI-only — Backend phải re-check (@RequiresPermission product-products:READ) — thiếu thì không gọi API
  const canRead = can(PRODUCT_PERMISSIONS.read);
  // Tìm kiếm / lọc / trang trên URL (`q`, `status`, `page`) — đổi lọc tự về trang 1, `debouncedQ` 300ms
  const url = useUrlFilters(TAXONOMY_STATUS_FILTERS);
  // BE chỉ có cờ `active` (một giá trị) → chọn một trạng thái thì thay cái đang chọn
  const status: TaxonomyStatusFilter | null = url.status[0] ?? null;
  const { q, debouncedQ, page, setPage } = url;
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
    // Cùng giá trị đã debounce với `params` — nếu không, cây ↔ phẳng đổi trước khi dữ liệu lọc về
    filtered: Boolean(debouncedQ.trim() || status),
    /** Tham số chung cho `GET /brands` / `GET /categories` (trang URL đếm từ 1, BE từ 0). */
    params: {
      page: Math.max(0, page - 1),
      size: config.pageSize,
      q: debouncedQ.trim() || undefined,
      active: status === null ? undefined : status === "active",
    },
    setQ: url.setQ,
    setStatus: (value: TaxonomyStatusFilter | null) => url.setStatus(value ? [value] : []),
    setPage,
    resetFilters: () => {
      url.setStatus([]);
      url.setQ("");
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
