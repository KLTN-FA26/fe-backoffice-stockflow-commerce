"use client";

import { INVENTORY_ITEM_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { PageHeader } from "@/components/shared/PageHeader";

import { buildInventoryItemColumns, inventoryItemViewColumn } from "./list/columns";
import { COLUMN_LABELS, DEFAULT_COLUMNS, FILTER_OPTIONS, LOCKED_COLUMNS } from "./list/constants";
import { InventoryItemListBody } from "./list/InventoryItemListBody";
import { buildSummaryItems } from "./list/summary";
import { useInventoryItemListState } from "./list/useInventoryItemListState";

const L = UI_LABELS.inventoryItem;

const COLUMNS = buildInventoryItemColumns();
const COLUMN_OPTIONS = DEFAULT_COLUMNS.map((c) => ({ label: COLUMN_LABELS[c] ?? c, value: c }));

function InventoryItemListContent() {
  // READ = đọc dữ liệu (tách khỏi VIEW_PAGE mở trang): thiếu thì không gọi API.
  // UI-only — Backend phải re-check (BE PR #119 @RequiresPermission).
  const canRead = useCan(INVENTORY_ITEM_PERMISSIONS.read);
  const s = useInventoryItemListState(canRead);
  const { filters } = s;
  const visibleColumns = [
    ...COLUMNS.filter((c) => s.config.visibleColumns.includes(c.key)),
    inventoryItemViewColumn(),
  ];

  return (
    <>
      <PageHeader title={L.title} subtitle={L.subtitle} />
      {/* Thiếu READ: không có dữ liệu để tìm/lọc → ẩn cả toolbar và thanh Cấu hình */}
      {canRead && (
        <ListToolbar
          search={filters.q}
          onSearchChange={(v) => void filters.setQ(v)}
          searchPlaceholder={L.searchPlaceholder}
          statusOptions={FILTER_OPTIONS}
          selectedStatuses={filters.status}
          onToggleStatus={s.toggleFilter}
          onClearStatuses={() => void filters.setStatus([])}
          hasStatusFilter={filters.status.length > 0}
          columnOptions={COLUMN_OPTIONS}
          selectedColumns={s.config.visibleColumns}
          defaultColumns={DEFAULT_COLUMNS}
          lockedColumns={LOCKED_COLUMNS}
          visibleColumnCount={s.config.visibleColumns.length}
          onToggleColumn={s.toggleColumn}
          onResetColumns={() => s.updateConfig((c) => ({ ...c, visibleColumns: DEFAULT_COLUMNS }))}
          hasColumnConfig={s.hasColumnConfig}
          summaryItems={buildSummaryItems(s)}
          onResetAll={s.resetAll}
          resetDisabled={!s.hasFilters && !s.hasColumnConfig}
        />
      )}
      <InventoryItemListBody s={s} columns={visibleColumns} />
    </>
  );
}

export function InventoryItemList() {
  return (
    <PermissionBoundary permissions={[INVENTORY_ITEM_PERMISSIONS.viewPage]} variant="list">
      <InventoryItemListContent />
    </PermissionBoundary>
  );
}
