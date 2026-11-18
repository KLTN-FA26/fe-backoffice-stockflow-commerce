import { INVENTORY_ITEM_COLUMNS, PAGE_SIZE, UI_LABELS } from "@/constants";

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
};

/** BE search quét SKU và mã vạch. */
export const SEARCH_SCOPE_LABEL = `${F.sku}, ${F.barcode.toLowerCase()}`;

/** BE `GET /inventory/items` chỉ lọc theo `q` (và `sku` chính xác) — không còn bộ lọc trạng thái. */
export const NO_FILTERS: readonly string[] = [];

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
