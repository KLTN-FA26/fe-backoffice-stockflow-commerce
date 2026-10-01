import { PAGE_SIZE } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/status-map";

import type { SupplierStatus } from "@/features/supplier/types";

/** Sở thích hiển thị của page (localStorage qua usePageConfig) — filter/search/sort/page nằm trên URL. */
export interface SupplierPageConfig {
  visibleColumns: string[];
  pageSize: number;
}

export const DEFAULT_COLUMNS = [
  "code",
  "name",
  "taxCode",
  "contact",
  "paymentTermDays",
  "leadTimeDays",
  "channel",
  "status",
  "actions",
];

export const PAGE_SIZE_OPTIONS: number[] = [PAGE_SIZE.sm, PAGE_SIZE.md, PAGE_SIZE.lg, PAGE_SIZE.xl];

export const DEFAULT_CONFIG: SupplierPageConfig = {
  visibleColumns: DEFAULT_COLUMNS,
  pageSize: PAGE_SIZE.md,
};

/** Cột được sort phía server — BE SortWhitelist: code/name/status/createdAt/lastModifiedAt (PR #36). */
export const SERVER_SORT_FIELDS = ["code", "name", "status"] as const;
export type ServerSortField = (typeof SERVER_SORT_FIELDS)[number];

/** BE search quét cố định 3 trường này (SupplierRepositoryAdapter, PR #36). */
export const SEARCH_SCOPE_LABEL = "Mã NCC, tên, mã số thuế";

export const COLUMN_LABELS: Record<string, string> = {
  code: "Mã NCC",
  name: "Tên nhà cung cấp",
  taxCode: "Mã số thuế",
  contact: "Liên hệ",
  paymentTermDays: "Thanh toán",
  leadTimeDays: "Giao hàng",
  channel: "Kênh gửi PO",
  status: "Trạng thái",
  actions: "Thao tác",
};

export const STATUS_OPTIONS: { label: string; value: SupplierStatus }[] = (
  ["Active", "Inactive"] as const
).map((value) => ({ label: STATUS_LABEL_VI[value] ?? value, value }));

export function mergeStoredConfig(
  stored: Partial<SupplierPageConfig>,
  fallback: SupplierPageConfig,
): SupplierPageConfig {
  const visibleColumns = (stored.visibleColumns ?? []).filter((c) => DEFAULT_COLUMNS.includes(c));
  return {
    visibleColumns: visibleColumns.length ? visibleColumns : fallback.visibleColumns,
    pageSize:
      stored.pageSize && PAGE_SIZE_OPTIONS.includes(stored.pageSize)
        ? stored.pageSize
        : fallback.pageSize,
  };
}
