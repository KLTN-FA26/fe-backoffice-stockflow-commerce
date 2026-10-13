"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import {
  ADMIN_ROUTES,
  GOODS_RECEIPT_PERMISSIONS,
  PO_PERMISSIONS,
  RECEIPT_COLUMNS,
  UI_LABELS,
} from "@/constants";
import { useCan, usePermissionChecker } from "@/lib/auth";
import { RECEIPT_CREATE_PERMISSIONS } from "@/features/receipt/lifecycle";
import { usePurchaseOrderNumbers } from "@/features/receipt/queries";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

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
  const can = usePermissionChecker();
  // Tạo phiếu cần đọc dòng PO → thêm purchase-orders:READ (seed BE không cấp cho NV kho)
  const canCreate = RECEIPT_CREATE_PERMISSIONS.every(can);
  const poNumbers = usePurchaseOrderNumbers(canRead && can(PO_PERMISSIONS.read)).data;
  const columns = useMemo(
    () => buildReceiptColumns(s.navigateToDetail, poNumbers),
    [s.navigateToDetail, poNumbers],
  );
  const visibleColumns = columns.filter((c) => s.config.visibleColumns.includes(c.key));
  const poNumber = s.po ? poNumbers?.[s.po] : undefined;
  const { filters } = s;

  return (
    <>
      <PageHeader
        title={UI_LABELS.receipt.pageTitle}
        subtitle="Kiểm đếm hàng về theo đơn đặt hàng, QC đầu vào và bàn giao cất hàng."
        actions={
          canCreate ? (
            <Button asChild size="sm" className="rounded-[var(--r-sm)]">
              <Link href={ADMIN_ROUTES.receipts.create}>
                <Plus className="size-3.5" /> {UI_LABELS.receipt.action.create}
              </Link>
            </Button>
          ) : undefined
        }
      />
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
            summaryItems={buildReceiptSummary(s, poNumber)}
            onResetAll={s.resetAll}
            resetDisabled={!s.hasFilters && !s.hasColumnConfig && s.sort.key === null}
          />
          <ReceiptListFilters s={s} poNumber={poNumber} />
        </>
      )}
      <ReceiptListBody s={s} columns={visibleColumns} canCreate={canCreate} />
    </>
  );
}

export function ReceiptList() {
  return (
    <ReceiptPermissionGate permissions={[GOODS_RECEIPT_PERMISSIONS.viewPage]} variant="list">
      <ReceiptListContent />
    </ReceiptPermissionGate>
  );
}
