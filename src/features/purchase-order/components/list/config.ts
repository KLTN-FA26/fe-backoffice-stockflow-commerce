import { PAGE_SIZE, PO_COLUMNS, PO_STATUSES, UI_LABELS } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";

import type { PurchaseOrder } from "@/features/purchase-order";

export type PoStatusFilter = "all" | PurchaseOrder["status"];

export type PoSearchField = typeof PO_COLUMNS.PO_NUMBER | typeof PO_COLUMNS.SUPPLIER | "poId";

export type PoColumnSearchKey = typeof PO_COLUMNS.PO_NUMBER | typeof PO_COLUMNS.SUPPLIER;

export type PoTableColumnKey = (typeof PO_COLUMNS)[keyof typeof PO_COLUMNS];

/** Sở thích hiển thị cá nhân → localStorage (state-persistence.md); filter/sort/page ở URL. */
export interface PurchaseOrdersPageConfig {
  showStats: boolean;
  statuses: PoStatusFilter[];
  globalSearch: { query: string; fields: PoSearchField[] };
  columnSearch: Partial<Record<PoColumnSearchKey, string>>;
  visibleColumns: PoTableColumnKey[];
  pageSize: number;
}

export const DEFAULT_VISIBLE_COLUMNS: PoTableColumnKey[] = [
  PO_COLUMNS.PO_NUMBER,
  PO_COLUMNS.SUPPLIER,
  PO_COLUMNS.EXPECTED_DATE,
  PO_COLUMNS.GRAND_TOTAL,
  PO_COLUMNS.STATUS,
  PO_COLUMNS.ACTIONS,
];

export const PAGE_SIZE_OPTIONS = [PAGE_SIZE.sm, PAGE_SIZE.md, PAGE_SIZE.lg, PAGE_SIZE.xl];

export const DEFAULT_CONFIG: PurchaseOrdersPageConfig = {
  showStats: false,
  statuses: ["all"],
  globalSearch: { query: "", fields: [PO_COLUMNS.PO_NUMBER, PO_COLUMNS.SUPPLIER] },
  columnSearch: {},
  visibleColumns: DEFAULT_VISIBLE_COLUMNS,
  pageSize: PAGE_SIZE.md,
};

/** Cột bảng → field sort BE (whitelist `ProcurementServiceImpl.SORT`). Cột khác không sort được. */
export const SERVER_SORT_BY_COLUMN: Partial<Record<PoTableColumnKey, string>> = {
  [PO_COLUMNS.PO_NUMBER]: "poNumber",
  [PO_COLUMNS.EXPECTED_DATE]: "expectedAt",
  [PO_COLUMNS.STATUS]: "status",
};

export const STATUS_OPTIONS = ["all", ...PO_STATUSES].map((value) => ({
  label: value === "all" ? "Tất cả" : (STATUS_LABEL_VI[value] ?? value),
  value: value as PoStatusFilter,
}));

export const TABLE_COLUMN_LABELS: Record<PoTableColumnKey, string> = {
  [PO_COLUMNS.ACTIONS]: "Thao tác",
  [PO_COLUMNS.EXPECTED_DATE]: UI_LABELS.purchaseOrder.expectedDateShort,
  [PO_COLUMNS.GRAND_TOTAL]: UI_LABELS.purchaseOrder.totalAmount,
  [PO_COLUMNS.PO_NUMBER]: "Mã PO",
  [PO_COLUMNS.STATUS]: UI_LABELS.purchaseOrder.status,
  [PO_COLUMNS.SUPPLIER]: UI_LABELS.purchaseOrder.supplier,
};

export const COLUMN_SEARCH_LABELS: Record<PoColumnSearchKey, string> = {
  [PO_COLUMNS.PO_NUMBER]: "Mã PO",
  [PO_COLUMNS.SUPPLIER]: UI_LABELS.purchaseOrder.supplier,
};

const isColumn = (v: string): v is PoTableColumnKey => v in TABLE_COLUMN_LABELS;
const isSearchField = (v: string): v is PoSearchField =>
  v === PO_COLUMNS.PO_NUMBER || v === PO_COLUMNS.SUPPLIER || v === "poId";

/** Gộp config cũ trong localStorage với default — bỏ cột/field không còn (vd cột "Kho nhận"). */
export function mergeStoredConfig(
  stored: Partial<PurchaseOrdersPageConfig>,
  fallback: PurchaseOrdersPageConfig,
): PurchaseOrdersPageConfig {
  const visible = (stored.visibleColumns ?? []).filter(isColumn);
  const fields = (stored.globalSearch?.fields ?? fallback.globalSearch.fields).filter(
    isSearchField,
  );
  return {
    ...fallback,
    ...stored,
    globalSearch: { query: "", fields },
    // Search trong cột sống trên URL (COLUMN_SEARCH_URL_KEYS), không đọc từ localStorage.
    columnSearch: {},
    visibleColumns: visible.length ? visible : DEFAULT_VISIBLE_COLUMNS,
    pageSize: PAGE_SIZE_OPTIONS.find((s) => s === stored.pageSize) ?? fallback.pageSize,
  };
}

/** Khoá URL cho search trong từng cột (filter → URL, xem state-persistence.md). */
export const COLUMN_SEARCH_URL_KEYS: Record<PoColumnSearchKey, string> = {
  poNumber: "colPoNumber",
  supplier: "colSupplier",
};
