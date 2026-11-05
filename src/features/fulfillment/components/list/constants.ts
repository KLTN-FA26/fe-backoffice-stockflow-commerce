import { FULFILLMENT_COLUMNS, PAGE_SIZE, STORAGE_KEYS, UI_LABELS } from "@/constants";

import type { FulfillmentScope } from "../primitives";

/** Sở thích hiển thị (localStorage qua usePageConfig) — trang nằm trên URL. */
export interface TaskPageConfig {
  visibleColumns: string[];
  pageSize: number;
}

const C = FULFILLMENT_COLUMNS;
const FIELD = UI_LABELS.fulfillment.field;

export const COLUMN_LABELS: Record<string, string> = {
  [C.TASK]: FIELD.task,
  [C.ORDER]: FIELD.order,
  [C.ASSIGNEE]: FIELD.assignee,
  [C.PICK_STATUS]: FIELD.pick,
  [C.PACK_STATUS]: FIELD.pack,
  [C.ASSIGNED_AT]: FIELD.assignedAt,
  [C.STARTED_AT]: "Bắt đầu lấy",
  [C.PICKED_AT]: "Lấy xong",
  [C.PACKED_AT]: FIELD.packedAt,
  [C.INTEGRITY]: "Đối chiếu thiết kế",
  [C.ACTIONS]: "Thao tác",
};

/** Mọi cột có thể bật ở cả hai màn; mặc định mỗi màn bật nhóm cột của công đoạn mình. */
export const ALL_COLUMNS: string[] = [
  C.TASK,
  C.ORDER,
  C.ASSIGNEE,
  C.PICK_STATUS,
  C.PACK_STATUS,
  C.ASSIGNED_AT,
  C.STARTED_AT,
  C.PICKED_AT,
  C.PACKED_AT,
  C.INTEGRITY,
  C.ACTIONS,
];

const DEFAULT_COLUMNS: Record<FulfillmentScope, string[]> = {
  picking: [
    C.TASK,
    C.ORDER,
    C.ASSIGNEE,
    C.PICK_STATUS,
    C.PACK_STATUS,
    C.ASSIGNED_AT,
    C.STARTED_AT,
    C.PICKED_AT,
    C.ACTIONS,
  ],
  packing: [
    C.TASK,
    C.ORDER,
    C.ASSIGNEE,
    C.PICK_STATUS,
    C.PACK_STATUS,
    C.INTEGRITY,
    C.PICKED_AT,
    C.PACKED_AT,
    C.ACTIONS,
  ],
};

export const PAGE_SIZE_OPTIONS: number[] = [PAGE_SIZE.sm, PAGE_SIZE.md, PAGE_SIZE.lg, PAGE_SIZE.xl];

export const STORAGE_KEY: Record<FulfillmentScope, string> = {
  picking: STORAGE_KEYS.adminPickingConfig,
  packing: STORAGE_KEYS.adminPackingConfig,
};

export function defaultColumns(scope: FulfillmentScope): string[] {
  return DEFAULT_COLUMNS[scope];
}

export function defaultConfig(scope: FulfillmentScope): TaskPageConfig {
  return { visibleColumns: DEFAULT_COLUMNS[scope], pageSize: PAGE_SIZE.md };
}

export function mergeStoredConfig(
  stored: Partial<TaskPageConfig>,
  fallback: TaskPageConfig,
): TaskPageConfig {
  const visibleColumns = (stored.visibleColumns ?? []).filter((c) => ALL_COLUMNS.includes(c));
  return {
    visibleColumns: visibleColumns.length ? visibleColumns : fallback.visibleColumns,
    pageSize:
      stored.pageSize && PAGE_SIZE_OPTIONS.includes(stored.pageSize)
        ? stored.pageSize
        : fallback.pageSize,
  };
}

/** Hai tập cột giống nhau (không xét thứ tự) → cấu hình cột đang ở mặc định. */
export function sameColumns(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((column) => b.includes(column));
}
