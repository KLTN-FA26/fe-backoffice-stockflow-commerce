"use client";

import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { toast } from "@/components/shared/Toast";

import type { PurchaseOrder } from "@/features/purchase-order";
import {
  DEFAULT_CONFIG,
  DEFAULT_VISIBLE_COLUMNS,
  STATUS_OPTIONS,
  TABLE_COLUMN_LABELS,
} from "./list/config";
import { PoListHeader } from "./list/PoListHeader";
import { PoListTable } from "./list/PoListTable";
import { usePoListColumns } from "./list/usePoListColumns";
import { usePoListController } from "./list/usePoListController";
import { buildPoSummaryItems, poListFlags } from "./list/poSummary";

export function PurchaseOrderList() {
  const c = usePoListController();
  const flags = poListFlags(c.config);
  const columns = usePoListColumns({
    suppliers: c.suppliers,
    warehouses: c.warehouses,
    columnSearch: c.config.columnSearch,
    onColumnSearch: c.updateColumnSearch,
    onNavigate: (po) => c.router.push(`/admin/purchase-orders/${po.poId}`),
  });
  const visibleColumns = columns.filter((col) => c.config.visibleColumns.includes(col.key));
  const summaryItems = buildPoSummaryItems(
    c.config,
    c.searchFields,
    flags.hasStatusFilter,
    flags.hasGlobalSearch,
    flags.hasFieldConfig,
    flags.activeColumnSearch,
    flags.visibleColumnCount,
    flags.hasColumnConfig,
    () => c.filters.setStatus([]),
    () => c.filters.setQ(""),
    () =>
      c.updateConfig((x) => ({
        ...x,
        globalSearch: { ...x.globalSearch, fields: DEFAULT_CONFIG.globalSearch.fields },
      })),
    () => c.updateConfig((x) => ({ ...x, columnSearch: {} })),
    () => c.updateConfig((x) => ({ ...x, visibleColumns: DEFAULT_VISIBLE_COLUMNS })),
  );

  if (c.isLoading) return <PageSkeleton variant="list" />;

  return (
    <>
      <PoListHeader
        showStats={c.config.showStats}
        stats={c.stats}
        onToggleStats={() => c.updateConfig((x) => ({ ...x, showStats: !x.showStats }))}
        onCreate={() => c.router.push("/admin/purchase-orders/create")}
      />
      <PoListTable
        search={c.config.globalSearch.query}
        onSearchChange={c.filters.setQ}
        statusProps={{
          options: STATUS_OPTIONS,
          selected: c.config.statuses,
          onToggle: c.toggleStatus,
          onClear: () => c.filters.setStatus([]),
          hasFilter: flags.hasStatusFilter,
        }}
        fieldProps={{
          options: c.searchFields as never,
          selected: c.config.globalSearch.fields as never,
          defaults: DEFAULT_CONFIG.globalSearch.fields as never,
          onToggle: c.toggleSearchField as never,
          onReset: () =>
            c.updateConfig((x) => ({
              ...x,
              globalSearch: { ...x.globalSearch, fields: DEFAULT_CONFIG.globalSearch.fields },
            })),
          onSelectAll: () =>
            c.updateConfig((x) => ({
              ...x,
              globalSearch: {
                ...x.globalSearch,
                fields: c.searchFields.map((f) => f.value) as never,
              },
            })),
          hasConfig: flags.hasFieldConfig,
        }}
        columnProps={{
          options: DEFAULT_VISIBLE_COLUMNS.map((col) => ({
            label: TABLE_COLUMN_LABELS[col],
            value: col,
          })),
          selected: c.config.visibleColumns,
          defaults: DEFAULT_VISIBLE_COLUMNS,
          locked: ["actions"],
          count: flags.visibleColumnCount,
          onToggle: c.toggleTableColumn as never,
          onReset: () => c.updateConfig((x) => ({ ...x, visibleColumns: DEFAULT_VISIBLE_COLUMNS })),
          hasConfig: flags.hasColumnConfig,
        }}
        selectedCount={c.selectedKeys.size}
        onBulkDelete={() => {
          toast.info("Xoá PO", `Đã chọn ${c.selectedKeys.size} đơn. Chức năng UI-only.`);
          c.setSelectedKeys(new Set());
        }}
        onExport={() =>
          toast.success("Xuất file mock", `Sẵn sàng xuất ${c.filtered.length} đơn đang hiển thị.`)
        }
        summaryItems={summaryItems}
        onResetAll={() => {
          c.updateConfig(() => DEFAULT_CONFIG);
          c.filters.reset();
        }}
        resetDisabled={!flags.hasAnyConfig}
        filtered={c.filtered}
        visibleColumns={visibleColumns as never}
        onRowClick={(r: PurchaseOrder) => c.router.push(`/admin/purchase-orders/${r.poId}`)}
        selectedKeys={c.selectedKeys}
        onSelectionChange={c.setSelectedKeys}
      />
    </>
  );
}
