import { PAGE_SIZE, RECEIPT_COLUMNS, RECEIPT_STATUS, RECEIPT_STATUSES } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";

import type { ReceiptStatus } from "@/constants";

/** Sở thích hiển thị (localStorage qua usePageConfig) — filter/search/sort/page nằm trên URL. */
export interface ReceiptPageConfig {
  visibleColumns: string[];
  pageSize: number;
}

const C = RECEIPT_COLUMNS;

export const DEFAULT_COLUMNS: string[] = [
  C.NUMBER,
  C.PURCHASE_ORDER,
  C.DELIVERY_NOTE,
  C.RECEIVED_AT,
  C.CONFIRMED_AT,
  C.STATUS,
  C.ACTIONS,
];

export const PAGE_SIZE_OPTIONS: number[] = [PAGE_SIZE.sm, PAGE_SIZE.md, PAGE_SIZE.lg, PAGE_SIZE.xl];

export const DEFAULT_CONFIG: ReceiptPageConfig = {
  visibleColumns: DEFAULT_COLUMNS,
  pageSize: PAGE_SIZE.md,
};

/**
 * Cột sort được → field BE. SortWhitelist của GoodsReceiptServiceImpl chỉ nhận
 * receivedAt / receiptNumber / status; mặc định receivedAt giảm dần.
 */
export const SERVER_SORT_FIELDS = {
  [C.NUMBER]: "receiptNumber",
  [C.RECEIVED_AT]: "receivedAt",
  [C.STATUS]: "status",
} as const satisfies Record<string, string>;
export type SortableColumn = keyof typeof SERVER_SORT_FIELDS;

/** BE search chỉ so khớp số phiếu (`Specs.contains("receiptNumber", …)`). */
export const SEARCH_SCOPE_LABEL = "Số phiếu nhận";

export const COLUMN_LABELS: Record<string, string> = {
  [C.NUMBER]: "Số phiếu",
  [C.PURCHASE_ORDER]: "Đơn đặt hàng",
  [C.DELIVERY_NOTE]: "Phiếu giao NCC",
  [C.RECEIVED_AT]: "Ngày nhận",
  [C.CONFIRMED_AT]: "Ngày xác nhận",
  [C.STATUS]: "Trạng thái",
  [C.ACTIONS]: "Thao tác",
};

/**
 * Bỏ `Confirmed` khỏi bộ lọc: BE `GoodsReceipt#confirm` chuyển thẳng sang In QC / In Putaway trong
 * cùng transaction — không phiếu nào được lưu ở trạng thái này, lọc theo nó luôn ra rỗng.
 */
export const STATUS_OPTIONS: { label: string; value: ReceiptStatus }[] = RECEIPT_STATUSES.filter(
  (value) => value !== RECEIPT_STATUS.CONFIRMED,
).map((value) => ({ label: STATUS_LABEL_VI[value] ?? value, value }));

export function mergeStoredConfig(
  stored: Partial<ReceiptPageConfig>,
  fallback: ReceiptPageConfig,
): ReceiptPageConfig {
  const visibleColumns = (stored.visibleColumns ?? []).filter((c) => DEFAULT_COLUMNS.includes(c));
  return {
    visibleColumns: visibleColumns.length ? visibleColumns : fallback.visibleColumns,
    pageSize:
      stored.pageSize && PAGE_SIZE_OPTIONS.includes(stored.pageSize)
        ? stored.pageSize
        : fallback.pageSize,
  };
}
