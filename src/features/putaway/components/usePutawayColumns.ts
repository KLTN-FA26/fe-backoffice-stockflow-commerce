import { PUTAWAY_COLUMNS as C, STORAGE_KEYS } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";

export type PutawayColumn = (typeof C)[keyof typeof C];

/** Cột dữ liệu theo thứ tự hiện — mặc định hiện hết. Cột thao tác không nằm trong danh sách bật / tắt. */
export const PUTAWAY_DATA_COLUMNS: readonly PutawayColumn[] = [
  C.LPN,
  C.SKU,
  C.LOT,
  C.QUANTITY,
  C.SOURCE_LOCATION,
  C.SOURCE,
  C.STATUS,
];
/** LPN là link sang màn cất thùng — luôn hiện. */
export const LOCKED_PUTAWAY_COLUMNS: PutawayColumn[] = [C.LPN];

interface PutawayConfig {
  visibleColumns: PutawayColumn[];
}

const DEFAULT_CONFIG: PutawayConfig = { visibleColumns: [...PUTAWAY_DATA_COLUMNS] };

const isColumn = (value: unknown): value is PutawayColumn =>
  PUTAWAY_DATA_COLUMNS.some((column) => column === value);

/** Bản lưu cũ có cột đã gỡ / thiếu cột khoá / rỗng → không làm vỡ bảng; giữ đúng thứ tự cột gốc. */
export function mergePutawayConfig(
  stored: Partial<PutawayConfig>,
  fallback: PutawayConfig,
): PutawayConfig {
  const kept = Array.isArray(stored.visibleColumns) ? stored.visibleColumns.filter(isColumn) : [];
  if (kept.length === 0) return fallback;
  return {
    visibleColumns: PUTAWAY_DATA_COLUMNS.filter(
      (column) => kept.includes(column) || LOCKED_PUTAWAY_COLUMNS.includes(column),
    ),
  };
}

/** Cột đang hiện — sở thích cá nhân, lưu localStorage qua `usePageConfig` (state-persistence), không lên URL. */
export function usePutawayColumns() {
  const { config, updateConfig } = usePageConfig(
    STORAGE_KEYS.adminPutawayConfig,
    DEFAULT_CONFIG,
    mergePutawayConfig,
  );
  const visible = config.visibleColumns;
  return {
    visible,
    hasColumnConfig: visible.length !== PUTAWAY_DATA_COLUMNS.length,
    toggle: (column: PutawayColumn) => {
      if (LOCKED_PUTAWAY_COLUMNS.includes(column)) return;
      updateConfig((current) => ({
        visibleColumns: PUTAWAY_DATA_COLUMNS.filter((c) =>
          c === column ? !current.visibleColumns.includes(c) : current.visibleColumns.includes(c),
        ),
      }));
    },
    reset: () => updateConfig(() => DEFAULT_CONFIG),
  };
}

export type PutawayColumnsState = ReturnType<typeof usePutawayColumns>;
