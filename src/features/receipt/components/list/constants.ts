import {
  PAGE_SIZE,
  RECEIPT_COLUMNS,
  RECEIPT_STATUS,
  RECEIPT_STATUSES,
  UI_LABELS,
} from "@/constants";
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
  C.RECEIPT_TYPE,
  C.PRODUCTION_ORDER,
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
  [C.RECEIPT_TYPE]: UI_LABELS.receipt.field.receiptType,
  [C.PRODUCTION_ORDER]: UI_LABELS.receipt.field.productionOrder,
  [C.DELIVERY_NOTE]: "Phiếu giao",
  [C.RECEIVED_AT]: "Ngày nhận",
  [C.CONFIRMED_AT]: "Ngày xác nhận",
  [C.STATUS]: "Trạng thái",
  [C.ACTIONS]: "Thao tác",
};

/**
 * Bộ lọc chỉ có 4 trạng thái của docs 03 §5. Bỏ `Confirmed` (BE chuyển thẳng sang In Putaway trong cùng
 * transaction xác nhận) và mã cũ `Pending Approval` (không còn bước duyệt) — lọc theo chúng luôn ra rỗng.
 */
const HIDDEN_FILTER_STATUSES: readonly ReceiptStatus[] = [
  RECEIPT_STATUS.CONFIRMED,
  RECEIPT_STATUS.PENDING_APPROVAL,
];

export const STATUS_OPTIONS: { label: string; value: ReceiptStatus }[] = RECEIPT_STATUSES.filter(
  (value) => !HIDDEN_FILTER_STATUSES.includes(value),
).map((value) => ({ label: STATUS_LABEL_VI[value] ?? value, value }));

/** Key cột "Đơn đặt hàng" đã bỏ (SCRUM-845) — chỉ còn để đọc cấu hình cũ trong localStorage. */
const LEGACY_PURCHASE_ORDER_COLUMN = "purchaseOrder";

/**
 * Cấu hình lưu trước SCRUM-845 có cột "Đơn đặt hàng" và chưa biết cột loại phiếu / Đơn sản xuất → thay cột cũ bằng
 * hai cột mới, để người dùng đã lưu cấu hình vẫn thấy chúng.
 */
function migrateLegacyColumns(columns: readonly string[]): string[] {
  return columns.flatMap((c) =>
    c === LEGACY_PURCHASE_ORDER_COLUMN ? [C.RECEIPT_TYPE, C.PRODUCTION_ORDER] : [c],
  );
}

export function mergeStoredConfig(
  stored: Partial<ReceiptPageConfig>,
  fallback: ReceiptPageConfig,
): ReceiptPageConfig {
  const visibleColumns = migrateLegacyColumns(stored.visibleColumns ?? []).filter((c) =>
    DEFAULT_COLUMNS.includes(c),
  );
  return {
    visibleColumns: visibleColumns.length ? visibleColumns : fallback.visibleColumns,
    pageSize:
      stored.pageSize && PAGE_SIZE_OPTIONS.includes(stored.pageSize)
        ? stored.pageSize
        : fallback.pageSize,
  };
}
