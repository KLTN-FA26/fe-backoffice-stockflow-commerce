"use client";

import { useMemo } from "react";

import { GOODS_RECEIPT_PERMISSIONS, RECEIPT_COLUMNS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { ListToolbar } from "@/components/shared/ListToolbar";

import { CreateReceiptAction } from "./create/CreateReceiptAction";
import { buildReceiptColumns } from "./list/columns";
import { COLUMN_LABELS, DEFAULT_COLUMNS, STATUS_OPTIONS } from "./list/constants";
import { ReceiptListBody } from "./list/ReceiptListBody";
import { ReceiptListFilters } from "./list/ReceiptListFilters";
import { buildReceiptSummary } from "./list/summary";
import { useReceiptListState } from "./list/useReceiptListState";
import { ReceiptPermissionGate } from "./ReceiptPermissionGate";

const COLUMN_OPTIONS = DEFAULT_COLUMNS.filter((c) => c !== RECEIPT_COLUMNS.ACTIONS).map((c) => ({
  label: COLUMN_LABELS[c] ?? c,
  value: c,
}));

function ReceiptListContent() {
  // READ = đọc dữ liệu (tách khỏi VIEW_PAGE mở trang — BE ADR-0004): thiếu thì không gọi API
  const canRead = useCan(GOODS_RECEIPT_PERMISSIONS.read);
  const s = useReceiptListState(canRead);
  const columns = useMemo(() => buildReceiptColumns(s.navigateToDetail), [s.navigateToDetail]);
  const visibleColumns = columns.filter((c) => s.config.visibleColumns.includes(c.key));
  const { filters } = s;

  return (
    // Giao diện kiểu Vercel như danh sách sản phẩm (globals.css `.surface-soft`): không tiêu đề hiển
    // thị — breadcrumb là tên trang. Nút lập phiếu theo Đơn sản xuất nằm trong `actions` (SCRUM-566).
    <div className="surface-soft">
      <h1 className="sr-only">{UI_LABELS.receipt.pageTitle}</h1>
      {canRead && (
        <>
          <ListToolbar
            search={filters.q}
            onSearchChange={(v) => void filters.setQ(v)}
            searchPlaceholder="Tìm theo số phiếu nhận (GR-…)"
            statusOptions={STATUS_OPTIONS}
            selectedStatuses={filters.status}
            onToggleStatus={s.toggleStatus}
            onClearStatuses={() => void filters.setStatus([])}
            hasStatusFilter={filters.status.length > 0}
            columnOptions={COLUMN_OPTIONS}
            selectedColumns={s.config.visibleColumns}
            defaultColumns={DEFAULT_COLUMNS}
            lockedColumns={[RECEIPT_COLUMNS.ACTIONS]}
            visibleColumnCount={s.visibleColumnCount}
            onToggleColumn={s.toggleColumn}
            onResetColumns={() =>
              s.updateConfig((c) => ({ ...c, visibleColumns: DEFAULT_COLUMNS }))
            }
            hasColumnConfig={s.hasColumnConfig}
            summaryItems={buildReceiptSummary(s)}
            onResetAll={s.resetAll}
            resetDisabled={!s.hasFilters && !s.hasColumnConfig && s.sort.key === null}
            actions={<CreateReceiptAction />}
          />
          <ReceiptListFilters s={s} />
        </>
      )}
      <ReceiptListBody s={s} columns={visibleColumns} />
    </div>
  );
}

export function ReceiptList() {
  return (
    <ReceiptPermissionGate permissions={[GOODS_RECEIPT_PERMISSIONS.viewPage]} variant="list">
      <ReceiptListContent />
    </ReceiptPermissionGate>
  );
}
