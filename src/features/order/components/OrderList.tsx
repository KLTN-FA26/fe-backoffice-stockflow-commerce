"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_ROUTES } from "@/constants";
import { DataTable } from "@/components/shared/DataTable";
import { ListStatsPanel } from "@/components/shared/ListStatsPanel";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { toast } from "@/components/shared/Toast";
import {
  DEFAULT_SEARCH_FIELDS,
  DEFAULT_VISIBLE_COLUMNS,
  ORDER_SEARCH_FIELDS,
  orderStatTiles,
} from "../list-config";
import { computeOrderStats, shouldFlagOrderRow } from "../selectors";
import {
  COLUMN_OPTIONS,
  SEARCH_FIELD_VALUES,
  STATUS_OPTIONS,
  buildOrderColumns,
} from "./order-columns";
import { OrderListHeaderActions } from "./order-list-header";
import { buildOrderSummaryItems, deriveOrderListFlags } from "./order-list-summary";
import { useFilteredOrders } from "./use-filtered-orders";
import { useOrderListState } from "./use-order-list-state";

export function OrderList() {
  const {
    status,
    setStatus,
    q,
    setQ,
    debouncedQ,
    config,
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
    updateConfig,
  } = useOrderListState();
  const router = useRouter();
  const filtered = useFilteredOrders({
    items: ordersQuery.data?.items,
    debouncedQ,
    searchFields: config.searchFields,
    columnSearch: config.columnSearch,
  });
  const stats = useMemo(() => orderStatTiles(computeOrderStats(filtered)), [filtered]);
  const columnMap = buildOrderColumns({
    columnSearch: config.columnSearch,
    onColumnSearch: updateColumnSearch,
  });
  const columns = DEFAULT_VISIBLE_COLUMNS.filter((k) => config.visibleColumns.includes(k)).map(
    (k) => columnMap[k],
  );
  const flags = deriveOrderListFlags({
    status,
    q,
    searchFields: config.searchFields,
    columnSearch: config.columnSearch,
    visibleColumns: config.visibleColumns,
    showStats: config.showStats,
  });
  const summaryItems = buildOrderSummaryItems({
    showStats: config.showStats,
    status,
    q,
    searchFields: config.searchFields,
    columnSearch: config.columnSearch,
    visibleColumnCount: flags.visibleColumnCount,
    hasStatusFilter: flags.hasStatusFilter,
    hasSearchQuery: flags.hasSearchQuery,
    hasFieldConfig: flags.hasFieldConfig,
    activeColumnSearchCount: flags.activeColumnSearch.length,
    hasColumnConfig: flags.hasColumnConfig,
    onClearStatus: () => setStatus([]),
    onClearQ: () => setQ(""),
    onResetFields: resetFields,
    onClearColumnSearch: clearColumnSearch,
    onResetColumns: resetColumns,
  });
  if (ordersQuery.isLoading) return <PageSkeleton variant="list" />;
  return (
    <>
      <PageHeader
        title="Đơn hàng"
        subtitle="Theo dõi đơn bán, trạng thái xử lý và các ngoại lệ cần thao tác."
        actions={
          <OrderListHeaderActions
            showStats={config.showStats}
            onToggle={() => updateConfig((c) => ({ ...c, showStats: !c.showStats }))}
          />
        }
      />
      <ListStatsPanel
        stats={stats}
        open={config.showStats}
        gridClassName="lg:grid-cols-4 xl:grid-cols-7"
      />
      <ListToolbar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder="Tìm đơn theo mã, khách, SĐT..."
        statusOptions={STATUS_OPTIONS}
        selectedStatuses={status}
        onToggleStatus={toggleStatus}
        onClearStatuses={() => setStatus([])}
        hasStatusFilter={flags.hasStatusFilter}
        fieldOptions={ORDER_SEARCH_FIELDS}
        selectedFields={config.searchFields}
        defaultFields={DEFAULT_SEARCH_FIELDS}
        onToggleField={toggleSearchField}
        onResetFields={resetFields}
        onSelectAllFields={() => updateConfig((c) => ({ ...c, searchFields: SEARCH_FIELD_VALUES }))}
        hasFieldConfig={flags.hasFieldConfig}
        columnOptions={COLUMN_OPTIONS}
        selectedColumns={config.visibleColumns}
        defaultColumns={DEFAULT_VISIBLE_COLUMNS}
        lockedColumns={["actions"]}
        visibleColumnCount={flags.visibleColumnCount}
        onToggleColumn={toggleTableColumn}
        onResetColumns={resetColumns}
        hasColumnConfig={flags.hasColumnConfig}
        selectedCount={selectedKeys.size}
        onBulkDelete={() => {
          toast.info(
            "Xoá đơn hàng",
            `Đã chọn ${selectedKeys.size} đơn hàng. Chức năng này đang ở UI-only.`,
          );
          setSelectedKeys(new Set());
        }}
        onExport={() =>
          toast.success(
            "Xuất file mock",
            `Sẵn sàng xuất ${filtered.length} đơn hàng đang hiển thị.`,
          )
        }
        summaryItems={summaryItems}
        onResetAll={resetAll}
        resetDisabled={!flags.hasAnyConfig}
      />
      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(row) => row.orderId}
        caption={`Hiển thị ${filtered.length} đơn hàng`}
        flagRow={shouldFlagOrderRow}
        onRowClick={(row) => router.push(ADMIN_ROUTES.orders.detail(row.orderId))}
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        pageSize={15}
      />
    </>
  );
}
