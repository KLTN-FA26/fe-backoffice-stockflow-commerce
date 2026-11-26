import { PAGE_SIZE, STORAGE_KEYS, WAREHOUSE_LOCATION_COLUMNS as C } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";

export type LocationColumn = (typeof C)[keyof typeof C];

/** Thứ tự cột của bảng; cột thao tác không đếm trong `x/y` và không ẩn được. */
export const LOCATION_COLUMNS: readonly LocationColumn[] = [
  C.CODE,
  C.KIND,
  C.ZONE,
  C.SHELF,
  C.LEVEL,
  C.STATUS,
  C.SKUS,
  C.ON_HAND,
  C.RESERVED,
  C.USES,
  C.CAPACITY,
  C.MAX_WEIGHT,
];
/** Cột cần tồn theo vị trí — bỏ khỏi bảng và khỏi ẩn hiện cột khi người xem không đọc được tồn. */
export const STOCK_COLUMNS: readonly LocationColumn[] = [C.SKUS, C.ON_HAND, C.RESERVED];
/** Mã vị trí mở chi tiết + sao chép — luôn hiện. */
export const LOCKED_LOCATION_COLUMNS: LocationColumn[] = [C.CODE];
export const LOCATION_PAGE_SIZES = [PAGE_SIZE.md, PAGE_SIZE.lg, PAGE_SIZE.xl, 100] as const;

interface LocationConfig {
  visibleColumns: LocationColumn[];
  pageSize: number;
}

const DEFAULT_CONFIG: LocationConfig = {
  visibleColumns: [...LOCATION_COLUMNS],
  pageSize: PAGE_SIZE.lg,
};

const isColumn = (value: unknown): value is LocationColumn =>
  LOCATION_COLUMNS.some((column) => column === value);

/** Bản lưu cũ có cột đã gỡ / thiếu cột khoá / rỗng / cỡ trang lạ → về mặc định phần đó, không vỡ bảng. */
function merge(stored: Partial<LocationConfig>, fallback: LocationConfig): LocationConfig {
  const kept = Array.isArray(stored.visibleColumns) ? stored.visibleColumns.filter(isColumn) : [];
  const pageSize = LOCATION_PAGE_SIZES.find((size) => size === stored.pageSize);
  return {
    visibleColumns:
      kept.length === 0
        ? fallback.visibleColumns
        : LOCATION_COLUMNS.filter(
            (column) => kept.includes(column) || LOCKED_LOCATION_COLUMNS.includes(column),
          ),
    pageSize: pageSize ?? fallback.pageSize,
  };
}

/**
 * Cột đang hiện + số dòng / trang — sở thích cá nhân, lưu localStorage qua `usePageConfig` (state-persistence).
 * `available` = cột dùng được với quyền hiện tại (không đọc được tồn → bỏ cột hàng).
 */
export function useLocationColumns(stockAvailable: boolean) {
  const { config, updateConfig } = usePageConfig(
    STORAGE_KEYS.adminWarehouseLocationsConfig,
    DEFAULT_CONFIG,
    merge,
  );
  const available = stockAvailable
    ? LOCATION_COLUMNS
    : LOCATION_COLUMNS.filter((column) => !STOCK_COLUMNS.includes(column));
  const visible = available.filter((column) => config.visibleColumns.includes(column));
  return {
    available,
    visible,
    pageSize: config.pageSize,
    hasColumnConfig: visible.length !== available.length,
    toggle: (column: LocationColumn) => {
      if (LOCKED_LOCATION_COLUMNS.includes(column)) return;
      updateConfig((current) => ({
        ...current,
        visibleColumns: LOCATION_COLUMNS.filter((c) =>
          c === column ? !current.visibleColumns.includes(c) : current.visibleColumns.includes(c),
        ),
      }));
    },
    setPageSize: (pageSize: number) => updateConfig((current) => ({ ...current, pageSize })),
    reset: () =>
      updateConfig((current) => ({ ...current, visibleColumns: DEFAULT_CONFIG.visibleColumns })),
  };
}

export type LocationColumnsState = ReturnType<typeof useLocationColumns>;
