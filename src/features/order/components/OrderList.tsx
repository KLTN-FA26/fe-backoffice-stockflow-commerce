"use client";

import Link from "next/link";
import { cn } from "cn";
import { ShieldAlert } from "lucide-react";

import { ADMIN_ROUTES, CREDIT_HOLD_PERMISSIONS, ORDER_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";

import { ListToolbar, TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

import { buildOrderColumns } from "./order-list/columns";
import { COLUMN_LABELS, DEFAULT_COLUMNS, STATUS_OPTIONS } from "./order-list/constants";
import { OrderListBody } from "./order-list/OrderListBody";
import { OrderListFilters } from "./order-list/OrderListFilters";
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
  // UI-only — Backend phải re-check (@RequiresPermission trên OrderController / CreditHoldController)
  const canSeeCreditHolds = useCan(CREDIT_HOLD_PERMISSIONS.viewPage);
  const s = useOrderListState(canRead);
  const columns = buildOrderColumns(s.extra.setCustomerId);
  const visibleColumns = columns.filter((c) => s.config.visibleColumns.includes(c.key));
  const { filters } = s;
  const creditHoldsLink = canSeeCreditHolds ? (
    <Button
      asChild
      variant="outline"
      size="sm"
      className={cn(
        "border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted",
        TOOLBAR_ACTION_CLASS,
      )}
    >
      <Link href={ADMIN_ROUTES.orders.creditHolds}>
        <ShieldAlert className="text-dot-warning size-3.5" aria-hidden="true" />
        {UI_LABELS.order.creditHoldsTitle}
      </Link>
    </Button>
  ) : undefined;

  return (
    <div className="surface-soft">
      {/* Trang danh sách kiểu Vercel (data-table-mode-a §1): không tiêu đề hiển thị — breadcrumb là tên trang. */}
      <h1 className="sr-only">{UI_LABELS.order.pageTitle}</h1>
      {/* Thiếu READ: không có dữ liệu để tìm/lọc → ẩn toolbar + thanh Cấu hình */}
      {canRead && (
        <ListToolbar
          search={filters.q}
          onSearchChange={(v) => void filters.setQ(v)}
          searchPlaceholder="Tìm theo mã đơn, người liên hệ / nhận, SĐT..."
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
          actions={creditHoldsLink}
        />
      )}
      {canRead && <OrderListFilters s={s} />}
      {!canRead && creditHoldsLink && (
        <div className="mb-3 flex justify-end">{creditHoldsLink}</div>
      )}
      <OrderListBody s={s} columns={visibleColumns} />
    </div>
  );
}
