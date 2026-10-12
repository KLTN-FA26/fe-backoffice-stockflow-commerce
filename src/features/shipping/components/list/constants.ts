import { LOAD_COLUMNS, LOAD_STATUSES, PAGE_SIZE, UI_LABELS } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";

import type { LoadStatus } from "@/constants";

/** Sở thích hiển thị (localStorage qua usePageConfig) — filter/search/page nằm trên URL. */
export interface LoadPageConfig {
  visibleColumns: string[];
  pageSize: number;
}

const C = LOAD_COLUMNS;

export const DEFAULT_COLUMNS: string[] = [
  C.NUMBER,
  C.VEHICLE,
  C.CARRIER,
  C.PROGRESS,
  C.STATUS,
  C.DISPATCHED_AT,
  C.ACTIONS,
];

export const PAGE_SIZE_OPTIONS: number[] = [PAGE_SIZE.sm, PAGE_SIZE.md, PAGE_SIZE.lg, PAGE_SIZE.xl];

export const DEFAULT_CONFIG: LoadPageConfig = {
  visibleColumns: DEFAULT_COLUMNS,
  pageSize: PAGE_SIZE.md,
};

/** ASSUMPTION contract SCRUM-288: search so khớp số chuyến + biển số xe. */
export const SEARCH_SCOPE_LABEL = "Số chuyến, biển số xe";

export const COLUMN_LABELS: Record<string, string> = {
  [C.NUMBER]: "Số chuyến",
  [C.VEHICLE]: "Xe",
  [C.CARRIER]: UI_LABELS.shipping.field.carrier,
  [C.PROGRESS]: "Đã lên xe",
  [C.STATUS]: "Trạng thái",
  [C.DISPATCHED_AT]: UI_LABELS.shipping.field.handedOverAt,
  [C.ACTIONS]: "Thao tác",
};

export const STATUS_OPTIONS: { label: string; value: LoadStatus }[] = LOAD_STATUSES.map(
  (value) => ({ label: STATUS_LABEL_VI[value] ?? value, value }),
);

export function mergeStoredConfig(
  stored: Partial<LoadPageConfig>,
  fallback: LoadPageConfig,
): LoadPageConfig {
  const visibleColumns = (stored.visibleColumns ?? []).filter((c) => DEFAULT_COLUMNS.includes(c));
  return {
    visibleColumns: visibleColumns.length ? visibleColumns : fallback.visibleColumns,
    pageSize:
      stored.pageSize && PAGE_SIZE_OPTIONS.includes(stored.pageSize)
        ? stored.pageSize
        : fallback.pageSize,
  };
}
