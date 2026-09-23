import { useState } from "react";

import { ORDER_STATUSES } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";
import { useUrlFilters } from "@/hooks/use-url-filters";

import {
  DEFAULT_ORDERS_CONFIG,
  DEFAULT_SEARCH_FIELDS,
  DEFAULT_VISIBLE_COLUMNS,
  mergeOrdersConfig,
  ORDERS_STORAGE_KEY,
} from "../list-config";
import { useOrders } from "../queries";

import type {
  OrderColumnSearchKey,
  OrdersPageConfig,
  OrderSearchField,
  OrderTableColumnKey,
} from "../list-config";

export function useOrderListState() {
  const { status, setStatus, q, setQ, debouncedQ } = useUrlFilters(ORDER_STATUSES);
  const { config, setConfig, updateConfig } = usePageConfig<OrdersPageConfig>(
    ORDERS_STORAGE_KEY,
    DEFAULT_ORDERS_CONFIG,
    mergeOrdersConfig,
  );
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const ordersQuery = useOrders({ status, q: debouncedQ, size: 200 });

  const toggleStatus = (v: (typeof ORDER_STATUSES)[number]) =>
    setStatus(status.includes(v) ? status.filter((s) => s !== v) : [...status, v]);
  const toggleSearchField = (f: OrderSearchField) =>
    updateConfig((c) => ({
      ...c,
      searchFields: c.searchFields.includes(f)
        ? c.searchFields.filter((x) => x !== f)
        : [...c.searchFields, f],
    }));
  const toggleTableColumn = (col: OrderTableColumnKey) => {
    if (col === "actions") return;
    updateConfig((c) => {
      const next = c.visibleColumns.includes(col)
        ? c.visibleColumns.filter((x) => x !== col)
        : [...c.visibleColumns, col];
      return { ...c, visibleColumns: next.includes("actions") ? next : [...next, "actions"] };
    });
  };
  const updateColumnSearch = (key: OrderColumnSearchKey, value: string) =>
    updateConfig((c) => ({ ...c, columnSearch: { ...c.columnSearch, [key]: value } }));
  const resetFields = () => updateConfig((c) => ({ ...c, searchFields: DEFAULT_SEARCH_FIELDS }));
  const resetColumns = () =>
    updateConfig((c) => ({ ...c, visibleColumns: DEFAULT_VISIBLE_COLUMNS }));
  const clearColumnSearch = () => updateConfig((c) => ({ ...c, columnSearch: {} }));
  const resetAll = () => {
    setConfig(DEFAULT_ORDERS_CONFIG);
    setStatus([]);
    setQ("");
  };

  return {
    status,
    setStatus,
    q,
    setQ,
    debouncedQ,
    config,
    updateConfig,
    selectedKeys,
    setSelectedKeys,
    ordersQuery,
    toggleStatus,
    toggleSearchField,
    toggleTableColumn,
    updateColumnSearch,
    resetFields,
    resetColumns,
    clearColumnSearch,
    resetAll,
  };
}
