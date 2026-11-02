import { PAGE_SIZE, TRANSFER_COLUMNS, TRANSFER_STATUSES, UI_LABELS } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";

import type { TransferStatus } from "@/constants";

/** Sở thích hiển thị (localStorage qua usePageConfig) — filter/search/page nằm trên URL. */
export interface TransferPageConfig {
  visibleColumns: string[];
  pageSize: number;
}

const C = TRANSFER_COLUMNS;

export const DEFAULT_COLUMNS: string[] = [
  C.NUMBER,
  C.FROM_WAREHOUSE,
  C.TO_WAREHOUSE,
  C.DELIVERY_MODE,
  C.EXPECTED_DATE,
  C.PACKED_AT,
  C.DISPATCHED_AT,
  C.CREATED_AT,
  C.STATUS,
  C.ACTIONS,
];

export const PAGE_SIZE_OPTIONS: number[] = [PAGE_SIZE.sm, PAGE_SIZE.md, PAGE_SIZE.lg, PAGE_SIZE.xl];

export const DEFAULT_CONFIG: TransferPageConfig = {
  visibleColumns: DEFAULT_COLUMNS,
  pageSize: PAGE_SIZE.md,
};

/** BE `TransferOrderSearch`: search chỉ so khớp số lệnh (chứa chuỗi). */
export const SEARCH_SCOPE_LABEL = UI_LABELS.transfer.field.searchScope;

export const COLUMN_LABELS: Record<string, string> = {
  [C.NUMBER]: UI_LABELS.transfer.column.number,
  [C.FROM_WAREHOUSE]: UI_LABELS.transfer.field.fromWarehouse,
  [C.TO_WAREHOUSE]: UI_LABELS.transfer.field.toWarehouse,
  [C.DELIVERY_MODE]: UI_LABELS.transfer.deliveryMode.label,
  [C.EXPECTED_DATE]: UI_LABELS.transfer.column.expectedDate,
  [C.PACKED_AT]: UI_LABELS.transfer.deliveryMode.packedAt,
  [C.DISPATCHED_AT]: UI_LABELS.transfer.column.dispatchedAt,
  [C.CREATED_AT]: UI_LABELS.transfer.column.createdAt,
  [C.STATUS]: UI_LABELS.transfer.column.status,
  [C.ACTIONS]: UI_LABELS.transfer.column.actions,
};

export const STATUS_OPTIONS: { label: string; value: TransferStatus }[] = TRANSFER_STATUSES.map(
  (value) => ({ label: STATUS_LABEL_VI[value] ?? value, value }),
);

export function mergeStoredConfig(
  stored: Partial<TransferPageConfig>,
  fallback: TransferPageConfig,
): TransferPageConfig {
  const visibleColumns = (stored.visibleColumns ?? []).filter((c) => DEFAULT_COLUMNS.includes(c));
  return {
    visibleColumns: visibleColumns.length ? visibleColumns : fallback.visibleColumns,
    pageSize:
      stored.pageSize && PAGE_SIZE_OPTIONS.includes(stored.pageSize)
        ? stored.pageSize
        : fallback.pageSize,
  };
}
