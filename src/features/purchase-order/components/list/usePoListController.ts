"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState, useQueryStates } from "nuqs";

import { PO_COLUMNS, PO_STATUSES, STORAGE_KEYS, UI_LABELS } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useSupplierRef, useSupplierRefs } from "@/lib/references/supplier-lookup";
import { usePoStatusDashboard, usePurchaseOrders } from "@/features/purchase-order";

import {
  COLUMN_SEARCH_URL_KEYS,
  DEFAULT_CONFIG,
  SERVER_SORT_BY_COLUMN,
  mergeStoredConfig,
} from "./config";
import { supplierLabel } from "./helpers";
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

type SortDir = "asc" | "desc";

export interface PoSearchFieldOption {
  label: string;
  value: PoSearchField;
  getValue: (po: PurchaseOrder) => string;
}

/** URL `sort=expectedAt,desc` → khoá cột cho DataTable.serverSorting. */
function parseSort(raw: string): { key: string | null; direction: SortDir } {
  const [prop = "", dir] = raw.split(",");
  const column = Object.entries(SERVER_SORT_BY_COLUMN).find(([, be]) => be === prop)?.[0];
  return { key: column ?? null, direction: dir === "desc" ? "desc" : "asc" };
}

/** Search trong cột là filter → URL (state-persistence.md), không localStorage. */
const COLUMN_SEARCH_PARSERS = {
  poNumber: parseAsString.withDefault(""),
  supplier: parseAsString.withDefault(""),
};

/**
 * State danh sách PO — status / supplierId / search trong cột / sort / page trên URL (nuqs),
 * cột + số dòng trong localStorage. Phân trang + lọc trạng thái/NCC + sắp xếp ở server (BE trang từ 0, URL từ 1).
 */
export function usePoListController(canRead: boolean) {
  const router = useRouter();
  const filters = useUrlFilters(PO_STATUSES);
  const [supplierId, setSupplierIdRaw] = useQueryState("supplierId", parseAsString.withDefault(""));
  const { config, updateConfig } = usePageConfig<PurchaseOrdersPageConfig>(
    STORAGE_KEYS.adminPurchaseOrdersConfig,
    DEFAULT_CONFIG,
    mergeStoredConfig,
  );
  const [columnSearch, setColumnSearch] = useQueryStates(COLUMN_SEARCH_PARSERS, {
    urlKeys: COLUMN_SEARCH_URL_KEYS,
  });
  const sort = parseSort(filters.sort);
  const poQ = usePurchaseOrders(
    {
      page: Math.max(0, filters.page - 1),
      size: config.pageSize,
      status: filters.status.length ? filters.status : undefined,
      supplierId: supplierId || undefined,
      sort: filters.sort || undefined,
    },
    { enabled: canRead },
  );
  const dashboardQ = usePoStatusDashboard({ enabled: canRead });
  const purchaseOrders = useMemo(() => poQ.data?.items ?? [], [poQ.data]);
  const supplierRefs = useSupplierRefs(purchaseOrders.map((po) => po.supplierId));
  const filterSupplierQ = useSupplierRef(supplierId || null);
  // Badge lọc NCC: tên NCC, hoặc nhãn đang tải / không tải được — không hiện UUID.
  const filterSupplierLabel = filterSupplierQ.data
    ? `${filterSupplierQ.data.code} — ${filterSupplierQ.data.name}`
    : filterSupplierQ.isError
      ? UI_LABELS.purchaseOrder.supplierUnavailable
      : UI_LABELS.purchaseOrder.supplierLoading;
  const searchFields = useMemo<PoSearchFieldOption[]>(
    () => [
      { label: "Mã PO", value: PO_COLUMNS.PO_NUMBER, getValue: (po) => po.poNumber },
      {
        label: UI_LABELS.purchaseOrder.supplier,
        value: PO_COLUMNS.SUPPLIER,
        getValue: (po) => supplierLabel(po, supplierRefs),
      },
      { label: "PO ID", value: "poId", getValue: (po) => po.poId },
    ],
    [supplierRefs],
  );
  const pageConfig = useMemo<PurchaseOrdersPageConfig>(
    () => ({
      ...config,
      statuses: filters.status.length ? filters.status : ["all"],
      globalSearch: { ...config.globalSearch, query: filters.q },
      columnSearch,
    }),
    [config, filters.q, filters.status, columnSearch],
  );
  const filtered = usePoFiltered(purchaseOrders, pageConfig, searchFields, supplierRefs);
  const stats = usePoStats(dashboardQ.data);

  const toggleStatus = (s: PoStatusFilter) => {
    if (s === "all") return filters.setStatus([]);
    const next: PoStatus[] = filters.status.includes(s)
      ? filters.status.filter((i) => i !== s)
      : [...filters.status, s];
    filters.setStatus(next);
  };
  const setSupplierId = (id: string) => {
    void setSupplierIdRaw(id || null);
    void filters.setPage(1);
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
    void setColumnSearch({ [k]: v || null });
  const clearColumnSearch = () => void setColumnSearch(null);
  const changeSort = (key: string, direction: SortDir) => {
    const be = Object.entries(SERVER_SORT_BY_COLUMN).find(([col]) => col === key)?.[1];
    if (!be) return;
    void filters.setSort(`${be},${direction}`);
    void filters.setPage(1);
  };
  // data-table-mode-a §5: đổi số dòng → về trang đầu.
  const setPageSize = (pageSize: number) => {
    updateConfig((c) => ({ ...c, pageSize }));
    void filters.setPage(1);
  };

  return {
    router,
    canRead,
    poQ,
    page: poQ.data,
    filters,
    sort,
    supplierId,
    filterSupplierLabel,
    setSupplierId,
    config: pageConfig,
    updateConfig,
    supplierRefs,
    searchFields,
    filtered,
    stats,
    toggleStatus,
    toggleSearchField,
    toggleTableColumn,
    updateColumnSearch,
    clearColumnSearch,
    changeSort,
    setPageSize,
  };
}

export type PoListController = ReturnType<typeof usePoListController>;
