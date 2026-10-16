"use client";

import { useMemo } from "react";

import { ORDER_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth";

import { ListToolbar } from "@/components/shared/ListToolbar";
import { PageHeader } from "@/components/shared/PageHeader";

import { buildOrderColumns } from "./order-list/columns";
import { COLUMN_LABELS, DEFAULT_COLUMNS, STATUS_OPTIONS } from "./order-list/constants";
import { OrderListBody } from "./order-list/OrderListBody";
import { buildSummaryItems } from "./order-list/summary";
import { useOrderListState } from "./order-list/useOrderListState";
import { OrderPermissionGate } from "./OrderPermissionGate";

const COLUMN_OPTIONS = DEFAULT_COLUMNS.filter((c) => c !== "actions").map((c) => ({
  label: COLUMN_LABELS[c] ?? c,
  value: c,
}));

/**
 * Danh sách đơn — phân trang/lọc/sắp xếp phía server, cùng pattern với danh sách NCC.
 * Không có bulk-select/xuất file: BE chưa có endpoint thao tác hàng loạt hay export đơn.
 */
export function OrderList() {
  return (
    <OrderPermissionGate permissions={[ORDER_PERMISSIONS.viewPage]} variant="list">
      <OrderListContent />
    </OrderPermissionGate>
  );
}

function OrderListContent() {
  // READ = đọc dữ liệu (tách khỏi VIEW_PAGE mở trang — BE ADR-0004): thiếu thì không gọi API
  const canRead = useCan(ORDER_PERMISSIONS.read);
  const s = useOrderListState(canRead);
  const columns = useMemo(() => buildOrderColumns(), []);
  const visibleColumns = columns.filter((c) => s.config.visibleColumns.includes(c.key));
  const { filters } = s;

  return (
    <>
      <PageHeader
        title="Đơn hàng"
        subtitle="Theo dõi đơn bán, trạng thái xử lý và các ngoại lệ cần thao tác."
      />
      {/* Thiếu READ: không có dữ liệu để tìm/lọc → ẩn toolbar + thanh Cấu hình */}
      {canRead && (
        <ListToolbar
          search={filters.q}
          onSearchChange={(v) => void filters.setQ(v)}
          searchPlaceholder="Tìm theo mã đơn, người nhận, SĐT..."
          statusOptions={STATUS_OPTIONS}
          selectedStatuses={filters.status}
          onToggleStatus={s.toggleStatus}
          onClearStatuses={() => void filters.setStatus([])}
          hasStatusFilter={filters.status.length > 0}
          columnOptions={COLUMN_OPTIONS}
          selectedColumns={s.config.visibleColumns}
          defaultColumns={DEFAULT_COLUMNS}
          lockedColumns={["actions"]}
          visibleColumnCount={s.visibleColumnCount}
          onToggleColumn={s.toggleColumn}
          onResetColumns={() => s.updateConfig((c) => ({ ...c, visibleColumns: DEFAULT_COLUMNS }))}
          hasColumnConfig={s.hasColumnConfig}
          summaryItems={buildSummaryItems(s)}
          onResetAll={s.resetAll}
          resetDisabled={!s.hasFilters && !s.hasColumnConfig && s.sort.key === null}
        />
      )}
      <OrderListBody s={s} columns={visibleColumns} />
    </>
  );
}
