import {
  DEFAULT_COLUMNS,
  DEFAULT_CONFIG,
  SEARCH_FIELDS,
  type SupplierPageConfig,
} from "./constants";

import type { SupplierDto } from "@/features/supplier/types";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function filterSuppliers(
  suppliers: SupplierDto[],
  pageConfig: SupplierPageConfig,
): SupplierDto[] {
  let list = suppliers;
  if (pageConfig.statuses.length > 0)
    list = list.filter((s) => pageConfig.statuses.includes(s.status));

  const q = normalize(pageConfig.globalSearch.query);
  if (q && pageConfig.globalSearch.fields.length > 0) {
    const fieldMap = new Map(SEARCH_FIELDS.map((field) => [field.value, field.getValue]));
    list = list.filter((s) =>
      pageConfig.globalSearch.fields.some((field) =>
        normalize(fieldMap.get(field)?.(s) ?? "").includes(q),
      ),
    );
  }

  const idQuery = normalize(pageConfig.columnSearch.supplierId ?? "");
  if (idQuery) list = list.filter((s) => normalize(s.supplierId).includes(idQuery));
  const nameQuery = normalize(pageConfig.columnSearch.name ?? "");
  if (nameQuery) list = list.filter((s) => normalize(s.name).includes(nameQuery));
  const taxQuery = normalize(pageConfig.columnSearch.taxCode ?? "");
  if (taxQuery) list = list.filter((s) => normalize(s.taxCode).includes(taxQuery));

  return list;
}

export function getActiveColumnSearch(pageConfig: SupplierPageConfig) {
  return Object.entries(pageConfig.columnSearch).filter(([, value]) => value?.trim());
}

export function hasAnyConfig(args: {
  hasStatusFilter: boolean;
  hasGlobalSearch: boolean;
  hasFieldConfig: boolean;
  activeColumnSearchCount: number;
  showStats: boolean;
  hasColumnConfig: boolean;
}) {
  return (
    args.hasStatusFilter ||
    args.hasGlobalSearch ||
    args.hasFieldConfig ||
    args.activeColumnSearchCount > 0 ||
    args.showStats ||
    args.hasColumnConfig
  );
}

export interface FilterFlags {
  hasStatusFilter: boolean;
  hasGlobalSearch: boolean;
  activeColumnSearch: [string, string][];
  hasFieldConfig: boolean;
  visibleColumnCount: number;
  hasColumnConfig: boolean;
  hasAny: boolean;
}

export function deriveFilterFlags(pageConfig: SupplierPageConfig) {
  const hasStatusFilter = pageConfig.statuses.length > 0;
  const hasGlobalSearch = Boolean(pageConfig.globalSearch.query.trim());
  const activeColumnSearch = getActiveColumnSearch(pageConfig);
  const hasFieldConfig =
    pageConfig.globalSearch.fields.length !== DEFAULT_CONFIG.globalSearch.fields.length ||
    pageConfig.globalSearch.fields.some(
      (field) => !DEFAULT_CONFIG.globalSearch.fields.includes(field),
    );
  const visibleColumnCount = pageConfig.visibleColumns.filter(
    (column) => column !== "actions",
  ).length;
  const hasColumnConfig = visibleColumnCount !== DEFAULT_COLUMNS.length - 1;
  return {
    hasStatusFilter,
    hasGlobalSearch,
    activeColumnSearch,
    hasFieldConfig,
    visibleColumnCount,
    hasColumnConfig,
    hasAny: hasAnyConfig({
      hasStatusFilter,
      hasGlobalSearch,
      hasFieldConfig,
      activeColumnSearchCount: activeColumnSearch.length,
      showStats: pageConfig.showStats,
      hasColumnConfig,
    }),
  };
}
