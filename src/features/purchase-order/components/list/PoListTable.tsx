"use client";

import { ADMIN_ROUTES, TOAST_MESSAGES } from "@/constants";
import { shouldFlagPoRow } from "@/features/purchase-order";
import { DataTable } from "@/components/shared/DataTable";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { RefetchBar } from "@/components/shared/RefetchBar";
import { toast } from "@/components/shared/Toast";

import {
  DEFAULT_CONFIG,
  DEFAULT_VISIBLE_COLUMNS,
  PAGE_SIZE_OPTIONS,
  STATUS_OPTIONS,
  TABLE_COLUMN_LABELS,
} from "./config";
import { buildPoSummaryItems, poListFlags } from "./poSummary";

import type { PaginatedResponse } from "@/lib/api/query-factory";
import type { PurchaseOrder } from "@/features/purchase-order";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { PoTableColumnKey } from "./config";
import type { PoListController } from "./usePoListController";

const COLUMN_OPTIONS = DEFAULT_VISIBLE_COLUMNS.map((col) => ({
  label: TABLE_COLUMN_LABELS[col],
  value: col,
}));
const LOCKED_COLUMNS: PoTableColumnKey[] = ["actions"];

/**
 * Toolbar luôn hiện (để đổi bộ lọc kể cả khi rỗng); thân là `body` (trạng thái rỗng/lỗi)
 * hoặc bảng phân trang + sắp xếp phía server.
 */
export function PoListTable({
  c,
  page,
  columns,
  body,
}: {
  c: PoListController;
  page: PaginatedResponse<PurchaseOrder> | undefined;
  columns: ColumnDef<PurchaseOrder>[];
  body?: React.ReactNode;
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
    onClearColumnSearch: c.clearColumnSearch,
    onClearColumns: resetColumns,
  });

  return (
    <>
      <ListToolbar
        search={c.config.globalSearch.query}
        onSearchChange={c.filters.setQ}
        // BE GET /purchase-orders không có tham số tìm kiếm tự do → ô tìm chỉ lọc trang đang xem.
        searchPlaceholder="Tìm PO theo mã, NCC trên trang đang xem..."
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
        // BE chưa có endpoint xuất PO (Action.EXPORT khai báo nhưng chưa dùng)
        onExport={() => toast.info(TOAST_MESSAGES.purchaseOrder.exportNotAvailable)}
        summaryItems={summaryItems}
        onResetAll={() => {
          c.updateConfig(() => DEFAULT_CONFIG);
          c.filters.reset();
          c.clearColumnSearch();
          c.setSupplierId("");
        }}
        resetDisabled={!flags.hasAnyConfig && !c.supplierId}
      />
      {body ??
        (page && (
          <>
            <RefetchBar active={c.poQ.isFetching} label="Đang tải lại danh sách đơn đặt hàng" />
            <DataTable
              data={c.filtered}
              columns={columns}
              rowKey={(r) => r.poId}
              caption={`Hiển thị ${c.filtered.length} / ${page.totalElements} đơn đặt hàng`}
              flagRow={shouldFlagPoRow}
              onRowClick={(r) => c.router.push(ADMIN_ROUTES.purchaseOrders.detail(r.poId))}
              pageSize={c.config.pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              serverPagination={{
                page: page.page,
                size: page.size,
                totalElements: page.totalElements,
                totalPages: page.totalPages,
                hasNext: page.hasNext,
                hasPrevious: page.hasPrevious,
                onPageChange: (p) => void c.filters.setPage(p + 1),
                onPageSizeChange: c.setPageSize,
              }}
              serverSorting={{
                key: c.sort.key,
                direction: c.sort.direction,
                onChange: c.changeSort,
              }}
            />
          </>
        ))}
    </>
  );
}
