import { PRODUCTION_SCHEDULE_COLUMNS as C, STORAGE_KEYS } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";

export type ScheduleColumn = (typeof C)[keyof typeof C];

/** Thứ tự cột của bảng Đơn sản xuất đang mở — mặc định hiện hết. */
export const SCHEDULE_COLUMNS: readonly ScheduleColumn[] = [
  C.CODE,
  C.PRODUCER,
  C.ORDER,
  C.WINDOW,
  C.WAREHOUSE,
  C.NEED_BY,
  C.EXPECTED,
  C.CARTONS,
  C.STATUS,
  C.ALERTS,
];
/** Mã Đơn sản xuất là link sang chi tiết — luôn hiện. */
export const LOCKED_SCHEDULE_COLUMNS: ScheduleColumn[] = [C.CODE];

interface ScheduleConfig {
  visibleColumns: ScheduleColumn[];
}

const DEFAULT_CONFIG: ScheduleConfig = { visibleColumns: [...SCHEDULE_COLUMNS] };

const isColumn = (value: unknown): value is ScheduleColumn =>
  SCHEDULE_COLUMNS.some((column) => column === value);

/** Bản lưu cũ có cột đã gỡ / thiếu cột khoá / rỗng → không làm vỡ bảng. */
function merge(stored: Partial<ScheduleConfig>, fallback: ScheduleConfig): ScheduleConfig {
  const kept = Array.isArray(stored.visibleColumns) ? stored.visibleColumns.filter(isColumn) : [];
  if (kept.length === 0) return fallback;
  return {
    visibleColumns: SCHEDULE_COLUMNS.filter(
      (column) => kept.includes(column) || LOCKED_SCHEDULE_COLUMNS.includes(column),
    ),
  };
}

/**
 * Cột đang hiện của bảng Đơn sản xuất trên lịch — sở thích hiển thị cá nhân nên lưu localStorage qua
 * `usePageConfig` (state-persistence), không lên URL.
 */
export function useScheduleColumns() {
  const { config, updateConfig } = usePageConfig(
    STORAGE_KEYS.adminProductionScheduleConfig,
    DEFAULT_CONFIG,
    merge,
  );
  const visible = config.visibleColumns;
  return {
    visible,
    hasColumnConfig: visible.length !== SCHEDULE_COLUMNS.length,
    toggle: (column: ScheduleColumn) => {
      if (LOCKED_SCHEDULE_COLUMNS.includes(column)) return;
      updateConfig((current) => ({
        visibleColumns: SCHEDULE_COLUMNS.filter((c) =>
          c === column ? !current.visibleColumns.includes(c) : current.visibleColumns.includes(c),
        ),
      }));
    },
    reset: () => updateConfig(() => DEFAULT_CONFIG),
  };
}

export type ScheduleColumnsState = ReturnType<typeof useScheduleColumns>;
