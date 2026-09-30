"use client";

import { ADMIN_ROUTES } from "@/constants";
import { DataTable } from "@/components/shared/DataTable";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { toast } from "@/components/shared/Toast";
import { shouldFlagPoRow } from "@/features/purchase-order";

import {
  DEFAULT_CONFIG,
  DEFAULT_VISIBLE_COLUMNS,
  STATUS_OPTIONS,
  TABLE_COLUMN_LABELS,
} from "./config";
import { buildPoSummaryItems, poListFlags } from "./poSummary";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { PurchaseOrder } from "@/features/purchase-order";
import type { PoTableColumnKey } from "./config";
import type { usePoListController } from "./usePoListController";

const COLUMN_OPTIONS = DEFAULT_VISIBLE_COLUMNS.map((col) => ({
  label: TABLE_COLUMN_LABELS[col],
  value: col,
}));
const LOCKED_COLUMNS: PoTableColumnKey[] = ["actions"];

export function PoListTable({
  c,
  columns,
}: {
  c: ReturnType<typeof usePoListController>;
  columns: ColumnDef<PurchaseOrder>[];
}) {
  const flags = poListFlags(c.config);
  const resetFields = () =>
    c.updateConfig((x) => ({
      ...x,
      globalSearch: { ...x.globalSearch, fields: DEFAULT_CONFIG.globalSearch.fields },
    }));
  const resetColumns = () =>
    c.updateConfig((x) => ({ ...x, visibleColumns: DEFAULT_VISIBLE_COLUMNS }));
  const summaryItems = buildPoSummaryItems(c.config, c.searchFields, flags, {
    onClearStatus: () => c.filters.setStatus([]),
    onClearQ: () => c.filters.setQ(""),
    onClearFields: resetFields,
    onClearColumnSearch: () => c.updateConfig((x) => ({ ...x, columnSearch: {} })),
    onClearColumns: resetColumns,
  });

  return (
    <>
      <ListToolbar
        search={c.config.globalSearch.query}
        onSearchChange={c.filters.setQ}
        searchPlaceholder="Tìm PO theo mã, NCC, kho..."
        statusOptions={STATUS_OPTIONS}
        selectedStatuses={c.config.statuses}
        onToggleStatus={c.toggleStatus}
        onClearStatuses={() => c.filters.setStatus([])}
        hasStatusFilter={flags.hasStatusFilter}
        fieldOptions={c.searchFields}
        selectedFields={c.config.globalSearch.fields}
        defaultFields={DEFAULT_CONFIG.globalSearch.fields}
        onToggleField={c.toggleSearchField}
        onResetFields={resetFields}
        onSelectAllFields={() =>
          c.updateConfig((x) => ({
            ...x,
            globalSearch: { ...x.globalSearch, fields: c.searchFields.map((f) => f.value) },
          }))
        }
        hasFieldConfig={flags.hasFieldConfig}
        columnOptions={COLUMN_OPTIONS}
        selectedColumns={c.config.visibleColumns}
        defaultColumns={DEFAULT_VISIBLE_COLUMNS}
        lockedColumns={LOCKED_COLUMNS}
        visibleColumnCount={flags.visibleColumnCount}
        onToggleColumn={c.toggleTableColumn}
        onResetColumns={resetColumns}
        hasColumnConfig={flags.hasColumnConfig}
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
      />
      <DataTable
        data={c.filtered}
        columns={columns}
        rowKey={(r) => r.poId}
        caption={`Hiển thị ${c.filtered.length} / ${c.total} đơn đặt hàng`}
        flagRow={shouldFlagPoRow}
        onRowClick={(r) => c.router.push(ADMIN_ROUTES.purchaseOrders.detail(r.poId))}
        selectable
        selectedKeys={c.selectedKeys}
        onSelectionChange={c.setSelectedKeys}
        pageSize={c.pageSize}
        total={c.total}
        page={c.page}
        onPageChange={c.filters.setPage}
        onPageSizeChange={c.setPageSize}
      />
      <p className="text-ink-tertiary mt-2 text-[0.6875rem]">
        Tìm kiếm chung và tìm theo cột chỉ lọc trên trang đã tải — BE chưa hỗ trợ tìm kiếm tự do
        (API list chỉ lọc theo trạng thái / NCC). Lọc trạng thái được thực hiện ở server.
      </p>
    </>
  );
}
