"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { ADMIN_ROUTES, CREDIT_HOLD_PERMISSIONS, ORDER_PERMISSIONS, UI_LABELS } from "@/constants";
import { PAYMENT_INSTALLMENT_PERMISSIONS } from "@/constants/payment";
import { useCan } from "@/lib/auth";

import { withHeaderFilters } from "@/components/shared/ColumnHeaderFilter";
import { HeaderActions } from "@/components/shared/HeaderActions";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

import { buildOrderColumns } from "./order-list/columns";
import {
  COLUMN_LABELS,
  DEFAULT_COLUMNS,
  FILTER_LABELS,
  STATUS_OPTIONS,
} from "./order-list/constants";
import { OrderListBody } from "./order-list/OrderListBody";
import { orderHeaderFilters } from "./order-list/order-header-filters";
import { buildSummaryItems } from "./order-list/summary";
import { useOrderListState } from "./order-list/useOrderListState";
import { OrderPermissionGate } from "./OrderPermissionGate";

const COLUMN_OPTIONS = DEFAULT_COLUMNS.filter((c) => c !== "actions").map((c) => ({
  label: COLUMN_LABELS[c] ?? c,
  value: c,
}));
const PAYMENT_COLUMN = "payment";

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
  // bo-17: BE chỉ kèm tiền của các đợt cho người đọc được đợt; trang chưa có field (BE trước PR #497) → không có cột.
  const canReadInstallments = useCan(PAYMENT_INSTALLMENT_PERMISSIONS.read);
  const s = useOrderListState(canRead);
  const paymentReported = s.query.data?.items.some((o) => o.paidAmount !== undefined) ?? false;
  const hasPaymentColumn = canReadInstallments && paymentReported;
  const columnOptions = hasPaymentColumn
    ? COLUMN_OPTIONS
    : COLUMN_OPTIONS.filter((c) => c.value !== PAYMENT_COLUMN);
  const columns = buildOrderColumns(s.extra.setCustomerId).filter(
    (c) => hasPaymentColumn || c.key !== PAYMENT_COLUMN,
  );
  const visibleColumns = withHeaderFilters(
    columns.filter((c) => s.config.visibleColumns.includes(c.key)),
    orderHeaderFilters(s),
  );
  const { filters } = s;
  // Lối sang hàng đợi giữ tín dụng nằm trên thanh breadcrumb (backoffice-erp-ui A1/A2: hàng tìm chỉ còn ô tìm)
  const creditHoldsLink = canSeeCreditHolds ? (
    <Button asChild variant="ghost" size="sm" className="text-ink-primary gap-2 font-medium">
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
      {creditHoldsLink && <HeaderActions>{creditHoldsLink}</HeaderActions>}
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
          columnOptions={columnOptions}
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
          controlsIn="summary"
        />
      )}
      {/* Khoảng ngày sai trên URL (link cũ / gõ tay) không gửi BE — nói rõ, vì ô lọc nằm trong popover của header cột.
          `?customer=` không phải UUID thì bị bỏ qua im lặng: không có ô gõ UUID để sửa. */}
      {canRead && s.extra.invalidRange && (
        <div role="alert" className="text-danger mb-2 space-y-0.5 text-xs">
          <p>{FILTER_LABELS.invalidRange}</p>
        </div>
      )}
      <OrderListBody s={s} columns={visibleColumns} />
    </div>
  );
}
