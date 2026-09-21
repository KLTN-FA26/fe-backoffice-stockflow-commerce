import { PO_COLUMNS, PO_STATUSES } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/status-map";

import type { PurchaseOrder } from "@/features/purchase-order";

export type PoStatusFilter = "all" | PurchaseOrder["status"];

export type PoSearchField =
  typeof PO_COLUMNS.PO_NUMBER | typeof PO_COLUMNS.SUPPLIER | typeof PO_COLUMNS.WAREHOUSE | "poId";

export type PoColumnSearchKey =
  typeof PO_COLUMNS.PO_NUMBER | typeof PO_COLUMNS.SUPPLIER | typeof PO_COLUMNS.WAREHOUSE;

export type PoTableColumnKey = (typeof PO_COLUMNS)[keyof typeof PO_COLUMNS];

export interface PurchaseOrdersPageConfig {
  showStats: boolean;
  statuses: PoStatusFilter[];
  globalSearch: { query: string; fields: PoSearchField[] };
  columnSearch: Partial<Record<PoColumnSearchKey, string>>;
  visibleColumns: PoTableColumnKey[];
}

export const DEFAULT_VISIBLE_COLUMNS: PoTableColumnKey[] = [
  PO_COLUMNS.PO_NUMBER,
  PO_COLUMNS.SUPPLIER,
  PO_COLUMNS.WAREHOUSE,
  PO_COLUMNS.EXPECTED_DATE,
  PO_COLUMNS.GRAND_TOTAL,
  PO_COLUMNS.STATUS,
  PO_COLUMNS.ACTIONS,
];

export const DEFAULT_CONFIG: PurchaseOrdersPageConfig = {
  showStats: false,
  statuses: ["all"],
  globalSearch: { query: "", fields: [PO_COLUMNS.PO_NUMBER, PO_COLUMNS.SUPPLIER] },
  columnSearch: {},
  visibleColumns: DEFAULT_VISIBLE_COLUMNS,
};

export const STATUS_OPTIONS = ["all", ...PO_STATUSES].map((value) => ({
  label: value === "all" ? "Tất cả" : (STATUS_LABEL_VI[value] ?? value),
  value: value as PoStatusFilter,
}));

export const TABLE_COLUMN_LABELS: Record<PoTableColumnKey, string> = {
  [PO_COLUMNS.ACTIONS]: "Thao tác",
  [PO_COLUMNS.EXPECTED_DATE]: "Ngày giao DK",
  [PO_COLUMNS.GRAND_TOTAL]: "Tổng tiền",
  [PO_COLUMNS.PO_NUMBER]: "Mã PO",
  [PO_COLUMNS.STATUS]: "Trạng thái",
  [PO_COLUMNS.SUPPLIER]: "Nhà cung cấp",
  [PO_COLUMNS.WAREHOUSE]: "Kho nhận",
};

export const COLUMN_SEARCH_LABELS: Record<PoColumnSearchKey, string> = {
  [PO_COLUMNS.PO_NUMBER]: "Mã PO",
  [PO_COLUMNS.SUPPLIER]: "Nhà cung cấp",
  [PO_COLUMNS.WAREHOUSE]: "Kho nhận",
};
