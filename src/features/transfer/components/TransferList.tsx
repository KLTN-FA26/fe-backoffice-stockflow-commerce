"use client";

import Link from "next/link";
import { cn } from "cn";
import { Plus } from "lucide-react";

import { ADMIN_ROUTES, TRANSFER_COLUMNS, TRANSFER_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { ListToolbar, TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

import { buildTransferColumns } from "./list/columns";
import { COLUMN_LABELS, DEFAULT_COLUMNS, STATUS_OPTIONS } from "./list/constants";
import { buildTransferSummary } from "./list/summary";
import { TransferListBody } from "./list/TransferListBody";
import { TransferListFilters } from "./list/TransferListFilters";
import { useTransferListState } from "./list/useTransferListState";
import { useWarehouseLabel } from "./primitives";
import { TransferPermissionGate } from "./TransferPermissionGate";

const L = UI_LABELS.transfer;
const COLUMN_OPTIONS = DEFAULT_COLUMNS.filter((c) => c !== TRANSFER_COLUMNS.ACTIONS).map((c) => ({
  label: COLUMN_LABELS[c] ?? c,
  value: c,
}));

function TransferListContent() {
  // READ tách khỏi VIEW_PAGE (BE ADR-0004): thiếu READ thì không gọi API
  const canRead = useCan(TRANSFER_PERMISSIONS.read);
  const canCreate = useCan(TRANSFER_PERMISSIONS.create);
  const s = useTransferListState(canRead);
  const warehouseLabel = useWarehouseLabel();
  const columns = buildTransferColumns(s.navigateToDetail, warehouseLabel);
  const visibleColumns = columns.filter((c) => s.config.visibleColumns.includes(c.key));
  const { filters } = s;

  const createAction = canCreate ? (
    <Button asChild size="sm" className={cn("bg-brand hover:bg-brand-hover", TOOLBAR_ACTION_CLASS)}>
      <Link href={ADMIN_ROUTES.transfers.create}>
        <Plus className="size-3.5" /> {L.action.create}
      </Link>
    </Button>
  ) : undefined;

  return (
    // Giao diện kiểu Vercel như danh sách sản phẩm (globals.css `.surface-soft`): không tiêu đề hiển
    // thị — breadcrumb là tên trang; nút tạo nằm cuối toolbar.
    <div className="surface-soft">
      <h1 className="sr-only">{L.pageTitle}</h1>
      {/* Thiếu READ nhưng có CREATE: không có toolbar nên nút tạo đứng riêng */}
      {!canRead && createAction && <div className="mb-3 flex justify-end">{createAction}</div>}
      {canRead && (
        <>
          <ListToolbar
            search={filters.q}
            onSearchChange={(v) => void filters.setQ(v)}
            searchPlaceholder={UI_LABELS.transfer.searchPlaceholder}
            statusOptions={STATUS_OPTIONS}
            selectedStatuses={filters.status}
            onToggleStatus={s.toggleStatus}
            onClearStatuses={() => void filters.setStatus([])}
            hasStatusFilter={filters.status.length > 0}
            columnOptions={COLUMN_OPTIONS}
            selectedColumns={s.config.visibleColumns}
            defaultColumns={DEFAULT_COLUMNS}
            lockedColumns={[TRANSFER_COLUMNS.ACTIONS]}
            visibleColumnCount={s.visibleColumnCount}
            onToggleColumn={s.toggleColumn}
            onResetColumns={() =>
              s.updateConfig((c) => ({ ...c, visibleColumns: DEFAULT_COLUMNS }))
            }
            hasColumnConfig={s.hasColumnConfig}
            summaryItems={buildTransferSummary(s, warehouseLabel)}
            onResetAll={s.resetAll}
            resetDisabled={!s.canResetAll}
            actions={createAction}
          />
          <TransferListFilters s={s} />
        </>
      )}
      <TransferListBody s={s} columns={visibleColumns} canCreate={canCreate} />
    </div>
  );
}

export function TransferList() {
  return (
    <TransferPermissionGate permissions={[TRANSFER_PERMISSIONS.viewPage]} variant="list">
      <TransferListContent />
    </TransferPermissionGate>
  );
}
