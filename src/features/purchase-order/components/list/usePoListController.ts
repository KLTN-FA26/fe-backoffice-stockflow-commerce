"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { PAGE_SIZE, PO_COLUMNS, PO_STATUSES, STORAGE_KEYS } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";
import { useUrlFilters } from "@/hooks/use-url-filters";
import {
  usePoStatusDashboard,
  usePoSuppliers,
  usePoWarehouses,
  usePurchaseOrders,
} from "@/features/purchase-order";

import type { PurchaseOrder } from "@/features/purchase-order";
import { DEFAULT_CONFIG } from "./config";
import { mergeStoredConfig, supplierName, warehouseName } from "./helpers";
import { usePoFiltered } from "./usePoFiltered";
import { usePoStats } from "./usePoStats";

import type {
  PoColumnSearchKey,
  PoSearchField,
  PoTableColumnKey,
  PurchaseOrdersPageConfig,
} from "./config";

export function usePoListController() {
  const router = useRouter();
  const filters = useUrlFilters(PO_STATUSES);
  const { config, updateConfig } = usePageConfig<PurchaseOrdersPageConfig>(
    STORAGE_KEYS.adminPurchaseOrdersConfig,
    DEFAULT_CONFIG,
    mergeStoredConfig,
  );
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE.md);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const poQ = usePurchaseOrders({
    page: filters.page,
    pageSize,
    status: filters.status.length ? (filters.status as string[]) : undefined,
    sort: filters.sort || undefined,
    q: filters.debouncedQ || undefined,
  });
  const supQ = usePoSuppliers({});
  const whQ = usePoWarehouses({});
  const dashboardQ = usePoStatusDashboard();
  const purchaseOrders = useMemo(() => poQ.data?.items ?? [], [poQ.data]);
  const suppliers = useMemo(() => supQ.data?.items ?? [], [supQ.data]);
  const warehouses = useMemo(() => whQ.data?.items ?? [], [whQ.data]);
  const searchFields = useMemo(
    () => [
      { label: "Mã PO", value: PO_COLUMNS.PO_NUMBER, getValue: (po: PurchaseOrder) => po.poNumber },
      {
        label: "Nhà cung cấp",
        value: PO_COLUMNS.SUPPLIER,
        getValue: (po: PurchaseOrder) => supplierName(po, suppliers),
      },
      {
        label: "Kho nhận",
        value: PO_COLUMNS.WAREHOUSE,
        getValue: (po: PurchaseOrder) => warehouseName(po, warehouses),
      },
      { label: "PO ID", value: "poId" as const, getValue: (po: PurchaseOrder) => po.poId },
    ],
    [suppliers, warehouses],
  );
  const pageConfig = useMemo<PurchaseOrdersPageConfig>(
    () => ({
      ...config,
      statuses: filters.status.length ? (filters.status as never) : ["all"],
      globalSearch: { ...config.globalSearch, query: filters.q },
    }),
    [config, filters.q, filters.status],
  );
  const filtered = usePoFiltered(purchaseOrders, pageConfig, searchFields, suppliers, warehouses);
  const stats = usePoStats(dashboardQ.data);

  const toggleStatus = (s: string) => {
    if (s === "all") {
      filters.setStatus([]);
      return;
    }
    const next = filters.status.includes(s as never)
      ? filters.status.filter((i) => i !== s)
      : [...filters.status, s as never];
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

  return {
    router,
    total: poQ.data?.total ?? 0,
    page: filters.page,
    pageSize,
    setPageSize,
    filters,
    config: pageConfig,
    updateConfig,
    selectedKeys,
    setSelectedKeys,
    poQ,
    supQ,
    whQ,
    suppliers,
    warehouses,
    searchFields,
    filtered,
    stats,
    toggleStatus,
    toggleSearchField,
    toggleTableColumn,
    updateColumnSearch,
    isLoading: poQ.isLoading || supQ.isLoading || whQ.isLoading,
  };
}
