import { CARTON_LIST_COLUMNS as C, CARTON_LIST_LIMITS, STORAGE_KEYS } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";

export type CartonColumn = (typeof C)[keyof typeof C];

/** Thứ tự cột; cột thao tác không đếm trong `x/y` và không ẩn được. */
export const CARTON_COLUMNS: readonly CartonColumn[] = [
  C.LPN,
  C.PRODUCT,
  C.WAREHOUSE,
  C.LOCATION,
  C.LOT,
  C.QTY,
  C.RESERVED,
  C.STATUS,
  C.STOCK_STATUS,
  C.RECEIVED_AT,
  C.SOURCE,
  C.OPEN_TASK,
];
/** Mặc định ẩn hai cột phụ cho bảng gọn — bật lại ở "Ẩn hiện cột". */
const HIDDEN_BY_DEFAULT: readonly CartonColumn[] = [C.RESERVED, C.SOURCE];
/** LPN mở chi tiết + sao chép — luôn hiện. */
export const LOCKED_CARTON_COLUMNS: CartonColumn[] = [C.LPN];

interface CartonConfig {
  visibleColumns: CartonColumn[];
  pageSize: number;
}

const DEFAULT_CONFIG: CartonConfig = {
  visibleColumns: CARTON_COLUMNS.filter((column) => !HIDDEN_BY_DEFAULT.includes(column)),
  pageSize: CARTON_LIST_LIMITS.defaultPageSize,
};

const isColumn = (value: unknown): value is CartonColumn =>
  CARTON_COLUMNS.some((column) => column === value);

/** Bản lưu cũ có cột đã gỡ / thiếu cột khoá / rỗng / cỡ trang lạ → về mặc định phần đó, không vỡ bảng. */
function merge(stored: Partial<CartonConfig>, fallback: CartonConfig): CartonConfig {
  const kept = Array.isArray(stored.visibleColumns) ? stored.visibleColumns.filter(isColumn) : [];
  const pageSize = CARTON_LIST_LIMITS.pageSizes.find((size) => size === stored.pageSize);
  return {
    visibleColumns:
      kept.length === 0
        ? fallback.visibleColumns
        : CARTON_COLUMNS.filter(
            (column) => kept.includes(column) || LOCKED_CARTON_COLUMNS.includes(column),
          ),
    pageSize: pageSize ?? fallback.pageSize,
  };
}

/** Cột đang hiện + số dòng / trang — sở thích cá nhân, `usePageConfig` (state-persistence), không lên URL. */
export function useCartonColumns() {
  const { config, updateConfig } = usePageConfig(
    STORAGE_KEYS.adminInventoryCartonsConfig,
    DEFAULT_CONFIG,
    merge,
  );
  const visible = config.visibleColumns;
  const isDefault =
    visible.length === DEFAULT_CONFIG.visibleColumns.length &&
    visible.every((column) => DEFAULT_CONFIG.visibleColumns.includes(column));
  return {
    visible,
    defaults: DEFAULT_CONFIG.visibleColumns,
    pageSize: config.pageSize,
    hasColumnConfig: !isDefault,
    toggle: (column: CartonColumn) => {
      if (LOCKED_CARTON_COLUMNS.includes(column)) return;
      updateConfig((current) => ({
        ...current,
        visibleColumns: CARTON_COLUMNS.filter((c) =>
          c === column ? !current.visibleColumns.includes(c) : current.visibleColumns.includes(c),
        ),
      }));
    },
    setPageSize: (pageSize: number) => updateConfig((current) => ({ ...current, pageSize })),
    reset: () =>
      updateConfig((current) => ({ ...current, visibleColumns: DEFAULT_CONFIG.visibleColumns })),
  };
}

export type CartonColumnsState = ReturnType<typeof useCartonColumns>;
