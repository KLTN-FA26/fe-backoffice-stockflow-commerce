import { INVENTORY_ITEM_COLUMNS, PAGE_SIZE, UI_LABELS } from "@/constants";
import { STORAGE_CLASSES } from "@/features/inventory-item/schemas";

import type { InventoryItemListParams } from "@/lib/references/inventory-item-keys";

const L = UI_LABELS.inventoryItem;

/** Sở thích hiển thị của page (localStorage qua usePageConfig) — filter/search/page nằm trên URL. */
export interface InventoryItemPageConfig {
  visibleColumns: string[];
  pageSize: number;
}

export const DEFAULT_COLUMNS: string[] = Object.values(INVENTORY_ITEM_COLUMNS);
/** SKU là cột định danh + link vào chi tiết — không cho ẩn. */
export const LOCKED_COLUMNS: string[] = [INVENTORY_ITEM_COLUMNS.SKU];

export const PAGE_SIZE_OPTIONS: number[] = [PAGE_SIZE.sm, PAGE_SIZE.md, PAGE_SIZE.lg, PAGE_SIZE.xl];

export const DEFAULT_CONFIG: InventoryItemPageConfig = {
  visibleColumns: DEFAULT_COLUMNS,
  pageSize: PAGE_SIZE.md,
};

const F = L.field;

/** Tiêu đề cột — dùng chung cho bảng, popover ẩn/hiện cột và thanh Cấu hình. */
export const COLUMN_LABELS: Record<string, string> = {
  [INVENTORY_ITEM_COLUMNS.SKU]: F.sku,
  [INVENTORY_ITEM_COLUMNS.UOM]: F.unitOfMeasure,
  [INVENTORY_ITEM_COLUMNS.BARCODE]: F.barcode,
  [INVENTORY_ITEM_COLUMNS.STORAGE]: F.storageClass,
  [INVENTORY_ITEM_COLUMNS.TRACKING]: F.trackingMode,
  [INVENTORY_ITEM_COLUMNS.POLICY]: F.policyConfigured,
};

/** BE search quét SKU và mã vạch. */
export const SEARCH_SCOPE_LABEL = `${F.sku}, ${F.barcode.toLowerCase()}`;

export const SUMMARY_LABELS = {
  ...L.summary,
  policy: F.policyConfigured,
  storage: F.storageClass,
} as const;

/** Giá trị filter ghép `nhóm:giá trị` — mỗi nhóm chọn tối đa 1. */
export const POLICY_PREFIX = "policy:";
export const STORAGE_PREFIX = "storage:";

export const FILTER_VALUES = [
  `${POLICY_PREFIX}configured`,
  `${POLICY_PREFIX}unconfigured`,
  ...STORAGE_CLASSES.map((c) => `${STORAGE_PREFIX}${c}` as const),
] as const;
export type FilterValue = (typeof FILTER_VALUES)[number];

export const FILTER_OPTIONS: { label: string; value: FilterValue }[] = [
  { label: L.policy.configured, value: "policy:configured" },
  { label: L.policy.unconfigured, value: "policy:unconfigured" },
  ...STORAGE_CLASSES.map((c) => ({
    label: L.storageClass[c],
    value: `${STORAGE_PREFIX}${c}` as FilterValue,
  })),
];

export const filterLabel = (value: string) =>
  FILTER_OPTIONS.find((o) => o.value === value)?.label ?? value;

/** Giá trị đã chọn (URL) → tham số BE. Nhóm nào có nhiều giá trị thì lấy giá trị cuối. */
export function toListParams(
  selected: readonly string[],
): Pick<InventoryItemListParams, "storageClass" | "policyConfigured"> {
  const params: Pick<InventoryItemListParams, "storageClass" | "policyConfigured"> = {};
  for (const value of selected) {
    if (value.startsWith(POLICY_PREFIX)) {
      params.policyConfigured = value === `${POLICY_PREFIX}configured`;
    } else if (value.startsWith(STORAGE_PREFIX)) {
      params.storageClass = value.slice(STORAGE_PREFIX.length);
    }
  }
  return params;
}

export function mergeStoredConfig(
  stored: Partial<InventoryItemPageConfig>,
  fallback: InventoryItemPageConfig,
): InventoryItemPageConfig {
  const visible = (stored.visibleColumns ?? []).filter((c) => DEFAULT_COLUMNS.includes(c));
  const withLocked = [...new Set([...LOCKED_COLUMNS, ...visible])];
  return {
    visibleColumns: visible.length ? withLocked : fallback.visibleColumns,
    pageSize:
      stored.pageSize && PAGE_SIZE_OPTIONS.includes(stored.pageSize)
        ? stored.pageSize
        : fallback.pageSize,
  };
}
