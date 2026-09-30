"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { PO_COLUMNS, PO_STATUSES, STORAGE_KEYS } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";
import { useUrlFilters } from "@/hooks/use-url-filters";
import {
  usePoStatusDashboard,
  usePoSuppliers,
  usePoWarehouses,
  usePurchaseOrders,
} from "@/features/purchase-order";

import { DEFAULT_CONFIG } from "./config";
import { mergeStoredConfig, supplierName, warehouseName } from "./helpers";
import { usePoFiltered } from "./usePoFiltered";
import { usePoStats } from "./usePoStats";

import type { PoStatus, PurchaseOrder } from "@/features/purchase-order";
import type {
  PoColumnSearchKey,
  PoSearchField,
  PoStatusFilter,
  PoTableColumnKey,
  PurchaseOrdersPageConfig,
} from "./config";

export interface PoSearchFieldOption {
  label: string;
  value: PoSearchField;
  getValue: (po: PurchaseOrder) => string;
}

export function usePoListController() {
  const router = useRouter();
  const filters = useUrlFilters(PO_STATUSES);
  const { config, updateConfig } = usePageConfig<PurchaseOrdersPageConfig>(
    STORAGE_KEYS.adminPurchaseOrdersConfig,
    DEFAULT_CONFIG,
    mergeStoredConfig,
  );
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  // BE list supports page/size/status/supplierId/sort only — no free-text `q`, so the main
  // search and the column search both filter the loaded page (see note under the table).
  const poQ = usePurchaseOrders({
    page: filters.page,
    pageSize: config.pageSize,
    status: filters.status.length ? filters.status : undefined,
    sort: filters.sort || undefined,
  });
  const supQ = usePoSuppliers({});
  const whQ = usePoWarehouses({});
  const dashboardQ = usePoStatusDashboard();
  const purchaseOrders = useMemo(() => poQ.data?.items ?? [], [poQ.data]);
  const suppliers = useMemo(() => supQ.data?.items ?? [], [supQ.data]);
  const warehouses = useMemo(() => whQ.data?.items ?? [], [whQ.data]);
  const searchFields = useMemo<PoSearchFieldOption[]>(
    () => [
      { label: "Mã PO", value: PO_COLUMNS.PO_NUMBER, getValue: (po) => po.poNumber },
      {
        label: "Nhà cung cấp",
        value: PO_COLUMNS.SUPPLIER,
        getValue: (po) => supplierName(po, suppliers),
      },
      {
        label: "Kho nhận",
        value: PO_COLUMNS.WAREHOUSE,
        getValue: (po) => warehouseName(po, warehouses),
      },
      { label: "PO ID", value: "poId", getValue: (po) => po.poId },
    ],
    [suppliers, warehouses],
  );
  const pageConfig = useMemo<PurchaseOrdersPageConfig>(
    () => ({
      ...config,
      statuses: filters.status.length ? filters.status : ["all"],
      globalSearch: { ...config.globalSearch, query: filters.q },
    }),
    [config, filters.q, filters.status],
  );
  const filtered = usePoFiltered(purchaseOrders, pageConfig, searchFields, suppliers, warehouses);
  const stats = usePoStats(dashboardQ.data);

  const toggleStatus = (s: PoStatusFilter) => {
    if (s === "all") return filters.setStatus([]);
    const next: PoStatus[] = filters.status.includes(s)
      ? filters.status.filter((i) => i !== s)
      : [...filters.status, s];
    filters.setStatus(next);
  };
  const toggleSearchField = (f: PoSearchField) =>
    updateConfig((c) => {
      const fields = c.globalSearch.fields.includes(f)
        ? c.globalSearch.fields.filter((i) => i !== f)
        : [...c.globalSearch.fields, f];
      return { ...c, globalSearch: { ...c.globalSearch, fields } };
    });
  const toggleTableColumn = (col: PoTableColumnKey) => {
    if (col === PO_COLUMNS.ACTIONS) return;
    updateConfig((c) => {
      const v = c.visibleColumns.includes(col)
        ? c.visibleColumns.filter((i) => i !== col)
        : [...c.visibleColumns, col];
      return {
        ...c,
        visibleColumns: v.includes(PO_COLUMNS.ACTIONS) ? v : [...v, PO_COLUMNS.ACTIONS],
      };
    });
  };
  const updateColumnSearch = (k: PoColumnSearchKey, v: string) =>
    updateConfig((c) => ({ ...c, columnSearch: { ...c.columnSearch, [k]: v } }));
  // data-table-mode-a §5: changing page size goes back to the first page.
  const setPageSize = (pageSize: number) => {
    updateConfig((c) => ({ ...c, pageSize }));
    filters.setPage(1);
  };

  return {
    router,
    total: poQ.data?.total ?? 0,
    page: filters.page,
    pageSize: config.pageSize,
    setPageSize,
    filters,
    config: pageConfig,
    updateConfig,
    selectedKeys,
    setSelectedKeys,
    poQ,
    suppliers,
    warehouses,
    masterDataError: supQ.isError || whQ.isError,
    searchFields,
    filtered,
    stats,
    toggleStatus,
    toggleSearchField,
    toggleTableColumn,
    updateColumnSearch,
    // Only the PO list gates the skeleton — FE-only master data may 404 on the real BE.
    isLoading: poQ.isLoading,
  };
}
