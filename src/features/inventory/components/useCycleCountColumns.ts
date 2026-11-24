import { CYCLE_COUNT_COLUMNS as C, CYCLE_COUNT_STORAGE_KEYS } from "@/constants/cycle-count";

import { usePageConfig } from "@/hooks/use-page-config";

export type CycleCountColumn = (typeof C)[keyof typeof C];

/** Cột dữ liệu theo thứ tự hiện — mặc định hiện hết. Cột "Mở phiếu" không nằm trong danh sách bật / tắt. */
export const CYCLE_COUNT_DATA_COLUMNS: readonly CycleCountColumn[] = [
  C.NUMBER,
  C.TRIGGER,
  C.STATUS,
  C.BLIND,
  C.PROGRESS,
  C.VARIANCES,
  C.PLANNED_DATE,
];
/** Mã phiếu là link sang chi tiết — luôn hiện. */
export const LOCKED_CYCLE_COUNT_COLUMNS: CycleCountColumn[] = [C.NUMBER];

interface CycleCountColumnsConfig {
  visibleColumns: CycleCountColumn[];
}

const DEFAULT_CONFIG: CycleCountColumnsConfig = { visibleColumns: [...CYCLE_COUNT_DATA_COLUMNS] };

const isColumn = (value: unknown): value is CycleCountColumn =>
  CYCLE_COUNT_DATA_COLUMNS.some((column) => column === value);

/** Bản lưu cũ có cột đã gỡ / thiếu cột khoá / rỗng → không làm vỡ bảng; giữ đúng thứ tự cột gốc. */
export function mergeCycleCountColumns(
  stored: Partial<CycleCountColumnsConfig>,
  fallback: CycleCountColumnsConfig,
): CycleCountColumnsConfig {
  const kept = Array.isArray(stored.visibleColumns) ? stored.visibleColumns.filter(isColumn) : [];
  if (kept.length === 0) return fallback;
  return {
    visibleColumns: CYCLE_COUNT_DATA_COLUMNS.filter(
      (column) => kept.includes(column) || LOCKED_CYCLE_COUNT_COLUMNS.includes(column),
    ),
  };
}

/** Cột đang hiện — sở thích cá nhân, lưu localStorage qua `usePageConfig` (state-persistence), không lên URL. */
export function useCycleCountColumns() {
  const { config, updateConfig } = usePageConfig(
    CYCLE_COUNT_STORAGE_KEYS.columns,
    DEFAULT_CONFIG,
    mergeCycleCountColumns,
  );
  const visible = config.visibleColumns;
  return {
    visible,
    hasColumnConfig: visible.length !== CYCLE_COUNT_DATA_COLUMNS.length,
    toggle: (column: CycleCountColumn) => {
      if (LOCKED_CYCLE_COUNT_COLUMNS.includes(column)) return;
      updateConfig((current) => ({
        visibleColumns: CYCLE_COUNT_DATA_COLUMNS.filter((c) =>
          c === column ? !current.visibleColumns.includes(c) : current.visibleColumns.includes(c),
        ),
      }));
    },
    reset: () => updateConfig(() => DEFAULT_CONFIG),
  };
}

export type CycleCountColumnsState = ReturnType<typeof useCycleCountColumns>;
