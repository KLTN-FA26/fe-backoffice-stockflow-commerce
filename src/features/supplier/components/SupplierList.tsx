"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { ADMIN_ROUTES, SUPPLIER_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { buildSupplierColumns } from "./supplier-list/columns";
import { COLUMN_LABELS, DEFAULT_COLUMNS, STATUS_OPTIONS } from "./supplier-list/constants";
import { SupplierListBody } from "./supplier-list/SupplierListBody";
import { buildSummaryItems } from "./supplier-list/summary";
import { useSupplierListState } from "./supplier-list/useSupplierListState";
import { SupplierPermissionGate } from "./SupplierPermissionGate";

const COLUMN_OPTIONS = DEFAULT_COLUMNS.filter((c) => c !== "actions").map((c) => ({
  label: COLUMN_LABELS[c] ?? c,
  value: c,
}));

function SupplierListContent() {
  const s = useSupplierListState();
  const canCreate = useCan(SUPPLIER_PERMISSIONS.create);
  // Ngừng hợp tác = DELETE → chọn nhiều dòng chỉ có ý nghĩa với người có quyền DELETE
  const canDelete = useCan(SUPPLIER_PERMISSIONS.delete);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const columns = useMemo(() => buildSupplierColumns(s.navigateToDetail), [s.navigateToDetail]);
  const visibleColumns = columns.filter((c) => s.config.visibleColumns.includes(c.key));
  const { filters } = s;

  return (
    <>
      <PageHeader
        title="Quản lý nhà cung cấp"
        subtitle="Hồ sơ nhà cung cấp, mã số thuế, điều khoản và kênh gửi đơn đặt hàng."
        actions={
          canCreate ? (
            <Button asChild size="sm" className="rounded-[var(--r-sm)]">
              <Link href={ADMIN_ROUTES.suppliers.create}>
                <Plus className="size-3.5" /> Thêm nhà cung cấp
              </Link>
            </Button>
          ) : undefined
        }
      />
      <ListToolbar
        search={filters.q}
        onSearchChange={(v) => void filters.setQ(v)}
        searchPlaceholder="Tìm theo mã NCC, tên, mã số thuế..."
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
        selectedCount={canDelete ? selectedKeys.size : 0}
        bulkDeleteLabel="Ngừng hợp tác đã chọn"
        onBulkDelete={canDelete ? () => setBulkConfirmOpen(true) : undefined}
        onExport={() => toast.info("Xuất Excel chưa có API — sẽ nối khi BE hỗ trợ")}
        summaryItems={buildSummaryItems(s)}
        onResetAll={s.resetAll}
        resetDisabled={!s.hasFilters && !s.hasColumnConfig && s.sort.key === null}
      />
      <SupplierListBody
        s={s}
        columns={visibleColumns}
        canCreate={canCreate}
        selectable={canDelete}
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
      />
      {/* Base UI: BE chỉ có DELETE từng NCC, chưa có endpoint hàng loạt — nối khi BE hỗ trợ */}
      <ConfirmDialog
        open={bulkConfirmOpen}
        onOpenChange={setBulkConfirmOpen}
        title="Chưa hỗ trợ ngừng hợp tác hàng loạt"
        description={`Đã chọn ${selectedKeys.size} nhà cung cấp. Hệ thống chưa có API thao tác hàng loạt — vui lòng ngừng hợp tác từng nhà cung cấp trong trang chi tiết.`}
        confirmLabel="Đã hiểu"
        variant="default"
        onConfirm={() => setBulkConfirmOpen(false)}
      />
    </>
  );
}

export function SupplierList() {
  return (
    <SupplierPermissionGate permission={SUPPLIER_PERMISSIONS.read} variant="list">
      <SupplierListContent />
    </SupplierPermissionGate>
  );
}
