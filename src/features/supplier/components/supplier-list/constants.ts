import type { SupplierDto, SupplierStatus } from "@/features/supplier/types";

export interface SupplierPageConfig {
  showStats: boolean;
  statuses: SupplierStatus[];
  globalSearch: { query: string; fields: string[] };
  columnSearch: Partial<Record<"supplierId" | "name" | "taxCode", string>>;
  visibleColumns: string[];
}

export const DEFAULT_COLUMNS = [
  "supplierId",
  "name",
  "taxCode",
  "contact",
  "leadTimeDays",
  "rating",
  "status",
  "actions",
];

export const DEFAULT_CONFIG: SupplierPageConfig = {
  showStats: false,
  statuses: [],
  globalSearch: { query: "", fields: ["supplierId", "name"] },
  columnSearch: {},
  visibleColumns: DEFAULT_COLUMNS,
};

export const SEARCH_FIELDS = [
  { label: "Mã NCC", value: "supplierId", getValue: (s: SupplierDto) => s.supplierId },
  { label: "Tên", value: "name", getValue: (s: SupplierDto) => s.name },
  { label: "Mã thuế", value: "taxCode", getValue: (s: SupplierDto) => s.taxCode },
  { label: "Email", value: "contactEmail", getValue: (s: SupplierDto) => s.contactEmail },
];

export const COLUMN_LABELS: Record<string, string> = {
  supplierId: "Mã NCC",
  name: "Tên nhà cung cấp",
  taxCode: "Mã thuế",
  contact: "Liên hệ",
  leadTimeDays: "Lead time",
  rating: "Đánh giá",
  status: "Trạng thái",
  actions: "Thao tác",
};

export const STATUS_LABELS: Record<SupplierStatus, string> = {
  Active: "Đang hoạt động",
  Inactive: "Ngừng hoạt động",
};

export const STATUS_OPTIONS: { label: string; value: SupplierStatus }[] = Object.entries(
  STATUS_LABELS,
).map(([value, label]) => ({ label, value: value as SupplierStatus }));

export function mergeStoredConfig(
  stored: Partial<SupplierPageConfig>,
  fallback: SupplierPageConfig,
): SupplierPageConfig {
  return {
    ...fallback,
    ...stored,
    globalSearch: { ...fallback.globalSearch, ...stored.globalSearch },
    columnSearch: stored.columnSearch ?? {},
    visibleColumns: stored.visibleColumns?.length ? stored.visibleColumns : DEFAULT_COLUMNS,
  };
}
